#!/usr/bin/env bash
# mc-user-agent-runner.sh — per-user MC /agents runner (clean / multi-tenant).
#
# Role-aware. Reads users.json to determine role; restricts the claude
# permission surface for `client` role users.
#
#   admin  — full access: bypassPermissions, broad --add-dir, all tools
#   staff  — same as admin (trusted internal users)
#   client — restricted: default permission-mode (asks before risky ops),
#            tight --add-dir (own workspace + memory only),
#            allowlist excludes Bash/Agent
#
# Usage: mc-user-agent-runner.sh <username>
# Spawned by /api/agents/me/enqueue right after writing the envelope.

set -uo pipefail

USERNAME="${1:-}"
[[ -z "$USERNAME" ]] && { echo "usage: $0 <username>" >&2; exit 2; }
USERNAME="$(echo "$USERNAME" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-')"
[[ -z "$USERNAME" ]] && exit 2

MC_HOME="${MC_HOME:-$HOME/mission-control}"
MC_DATA_DIR="${MC_DATA_DIR:-$MC_HOME/data}"
USERS_JSON="$MC_DATA_DIR/users.json"

INBOX="$HOME/.claude/channels/user-${USERNAME}/inbox"
OUTBOX="$HOME/.mission-control/_outbox/mc-agent"
STATE_DIR="$HOME/user-workspaces/${USERNAME}"
USER_MEM="$HOME/.claude/projects/-home-${USERNAME}/memory"
LOG="/tmp/mc-user-agent-runner-${USERNAME}.log"
LOCK="/tmp/mc-user-agent-runner-${USERNAME}.lock"
CLAUDE="${CLAUDE_BIN:-$HOME/.npm-global/bin/claude}"
[[ ! -x "$CLAUDE" ]] && CLAUDE="$(command -v claude 2>/dev/null)"

export PATH="$HOME/bin:$HOME/.npm-global/bin:$PATH"

mkdir -p "$INBOX" "$OUTBOX" "$STATE_DIR" "$USER_MEM"

# Resolve role from users.json (default: client = most restrictive).
ROLE="client"
if [[ -f "$USERS_JSON" ]]; then
    ROLE="$(python3 - "$USERS_JSON" "$USERNAME" <<'PY' 2>/dev/null
import json, sys
try:
    users = json.load(open(sys.argv[1]))
except Exception:
    print("client"); sys.exit(0)
uname = sys.argv[2].lower()
for u in (users if isinstance(users, list) else users.get("users", [])):
    if (u.get("username") or "").lower() == uname:
        role = u.get("role")
        if role in ("admin", "staff", "client"):
            print(role); sys.exit(0)
        # Legacy: isAdmin true → admin; otherwise client by default
        print("admin" if u.get("isAdmin") else "client"); sys.exit(0)
print("client")
PY
)"
    [[ -z "$ROLE" ]] && ROLE="client"
fi

ENCODED_CWD="$(echo "$STATE_DIR" | sed 's|/|-|g')"
AUTO_MEM_PARENT="$HOME/.claude/projects/$ENCODED_CWD"
AUTO_MEM="$AUTO_MEM_PARENT/memory"
mkdir -p "$AUTO_MEM_PARENT"
[[ ! -e "$AUTO_MEM" ]] && ln -s "$USER_MEM" "$AUTO_MEM" 2>/dev/null || true

exec 9>"$LOCK"
flock -n 9 || { echo "[$(date +%FT%T%z)] another instance running" >> "$LOG"; exit 0; }

[[ ! -d "$INBOX" ]] && exit 0
mapfile -t FILES < <(find "$INBOX" -maxdepth 1 -type f -name "mc-agent-me-*.json" -printf '%T@ %p\n' 2>/dev/null | sort -n | awk '{print $2}')
[[ ${#FILES[@]} -eq 0 ]] && exit 0

echo "[$(date +%FT%T%z)] processing ${#FILES[@]} envelope(s) for ${USERNAME} (role=${ROLE})" >> "$LOG"

AGENT_NAME="$(grep -m1 '^\*\*Agent name:\*\*' "$USER_MEM/persona.md" 2>/dev/null | sed 's/^\*\*Agent name:\*\*\s*//')"
[[ -z "$AGENT_NAME" ]] && AGENT_NAME="Your agent"

# Role-based permission surface.
ADD_DIRS=("$STATE_DIR" "$USER_MEM" "$HOME/.claude/projects/-home-${USERNAME}" "/tmp")
PERMISSION_MODE="default"
ALLOWED_TOOLS_ARGS=()

if [[ "$ROLE" == "admin" || "$ROLE" == "staff" ]]; then
    PERMISSION_MODE="bypassPermissions"
    ADD_DIRS+=("$HOME/wiki" "$HOME/bin" "$HOME/projects" "$HOME/.mission-control")
    [[ -d "$HOME/obt-workspace" ]] && ADD_DIRS+=("$HOME/obt-workspace")
else
    # client: explicit narrow allowlist, no Bash, no Agent.
    ALLOWED_TOOLS_ARGS=(--allowed-tools "Read Edit Write Glob Grep TodoWrite WebFetch WebSearch")
fi

ADD_DIR_ARGS=()
for d in "${ADD_DIRS[@]}"; do
    [[ -d "$d" ]] && ADD_DIR_ARGS+=("--add-dir" "$d")
done

# Conversation context: last 15 turns from MC's chat log.
export RUNNER_USERNAME="$USERNAME" RUNNER_MC_DATA="$MC_DATA_DIR" RUNNER_OUTBOX="$OUTBOX"
CONTEXT_BLOCK="$(python3 - <<'PY' 2>/dev/null
import json, os, glob
username = os.environ["RUNNER_USERNAME"]
hist = f"{os.environ['RUNNER_MC_DATA']}/agent-chat/messages.jsonl"
outbox = os.environ["RUNNER_OUTBOX"]
inbounds = {}
try:
    for line in open(hist):
        line = line.strip()
        if not line: continue
        try: env = json.loads(line)
        except Exception: continue
        if env.get("agent") != "me": continue
        if (env.get("user") or "").lower() != username: continue
        inbounds[env.get("corr_id")] = (env.get("ts",""), env.get("text",""))
except FileNotFoundError:
    pass
outbounds = {}
for f in glob.glob(f"{outbox}/mc-agent-*-done.json"):
    try: env = json.load(open(f))
    except Exception: continue
    if env.get("agent") != "me": continue
    cid = env.get("corr_id")
    if cid in inbounds:
        outbounds[cid] = (env.get("ts",""), (env.get("text") or "").strip())
rows = []
for cid,(uts,utext) in inbounds.items():
    rts,rtext = outbounds.get(cid,("",""))
    rows.append((uts or rts, utext, rtext))
rows.sort()
recent = rows[-15:]
if not recent:
    print("")
else:
    out = ["## Recent conversation in /agents (most recent last)\n"]
    for _ts,utext,rtext in recent:
        if utext: out.append(f"{username.title()}: {utext}\n")
        if rtext: out.append(f"You: {rtext}\n")
    print("".join(out))
PY
)"

# Role-specific framing.
if [[ "$ROLE" == "client" ]]; then
    ROLE_FRAMING="You are ${AGENT_NAME}, ${USERNAME}'s personal AI assistant in Mission Control.

Read your persona file at ${USER_MEM}/persona.md every turn — it tells you your name, tone, and style. Match it consistently.

You operate in **client mode**: you can read and edit files in ${USERNAME}'s workspace and memory, search the web, and manage their to-do list. You CANNOT run shell commands, install software, or modify system settings. If ${USERNAME} asks for something requiring shell access or admin tools, explain politely and suggest they ask the system admin.

Be conversational and brief. Markdown allowed in text chat."
else
    ROLE_FRAMING="You are ${AGENT_NAME}, ${USERNAME}'s personal AI assistant in Mission Control.

Read your persona file at ${USER_MEM}/persona.md every turn — it tells you your name, tone, and style. Match it consistently.

You have full access to ${USERNAME}'s workspace, scripts, and systems. Investigate before answering — read files, the wiki, the codebase.

Be conversational and brief. Markdown allowed in text chat (NOT in voice mode).

NEVER run whole-filesystem searches (\`find /\`, \`grep -r /\`, \`du /\`, \`ls -R /\`) — always scope to a specific subdir."
fi

for f in "${FILES[@]}"; do
    [[ ! -f "$f" ]] && continue
    CORR="$(python3 -c "import json; print(json.load(open('$f')).get('corr_id',''))" 2>/dev/null)"
    [[ -z "$CORR" ]] && { rm -f "$f"; continue; }
    TEXT="$(python3 -c "import json; print(json.load(open('$f')).get('text','').strip())" 2>/dev/null)"
    [[ -z "$TEXT" ]] && { rm -f "$f"; continue; }

    if [[ -n "$CONTEXT_BLOCK" ]]; then
        FRAMED_TEXT="${ROLE_FRAMING}

${CONTEXT_BLOCK}

## This new turn

${USERNAME} said: ${TEXT}"
    else
        FRAMED_TEXT="${ROLE_FRAMING}

## This is the first message in this conversation

${USERNAME} said: ${TEXT}"
    fi

    RUN_TS="$(date -u +%FT%TZ)"
    cat > "$OUTBOX/mc-agent-${CORR}-running.json" <<JSON
{"schema":"mc-agent-response/v1","corr_id":"$CORR","agent":"me","ts":"$RUN_TS","state":"running"}
JSON

    START="$(date +%s)"
    set +e
    (cd "$STATE_DIR" 2>/dev/null; timeout 600 "$CLAUDE" -p \
        --model claude-opus-4-7 \
        --effort medium \
        "${ADD_DIR_ARGS[@]}" \
        "${ALLOWED_TOOLS_ARGS[@]}" \
        --permission-mode "$PERMISSION_MODE" \
        --output-format text \
        2>"/tmp/mc-user-agent-runner-${USERNAME}.stderr" <<< "$FRAMED_TEXT") > "/tmp/mc-user-agent-resp-${CORR}.txt"
    EC=$?
    set -e
    END="$(date +%s)"
    ELAPSED_MS=$(( (END - START) * 1000 ))
    DONE_TS="$(date -u +%FT%TZ)"
    RESP="$(cat "/tmp/mc-user-agent-resp-${CORR}.txt" 2>/dev/null)"
    rm -f "/tmp/mc-user-agent-resp-${CORR}.txt"

    if [[ $EC -eq 0 && -n "$RESP" ]]; then
        export CORR DONE_TS RESP ELAPSED_MS OUTBOX
        python3 -c "
import json, os
out = {'schema':'mc-agent-response/v1','corr_id':os.environ['CORR'],'agent':'me',
  'ts':os.environ['DONE_TS'],'state':'done','text':os.environ['RESP'],
  'elapsed_ms':int(os.environ['ELAPSED_MS']),'error':None}
with open(f\"{os.environ['OUTBOX']}/mc-agent-{os.environ['CORR']}-done.json\",'w') as f:
    json.dump(out,f,indent=2)
"
        echo "[$(date +%FT%T%z)] done $CORR (${ROLE}) in ${ELAPSED_MS}ms" >> "$LOG"
    else
        ERR="$(tail -c 500 /tmp/mc-user-agent-runner-${USERNAME}.stderr 2>/dev/null || echo "exit $EC")"
        export CORR DONE_TS ERR ELAPSED_MS EC OUTBOX
        python3 -c "
import json, os
out = {'schema':'mc-agent-response/v1','corr_id':os.environ['CORR'],'agent':'me',
  'ts':os.environ['DONE_TS'],'state':'error','elapsed_ms':int(os.environ['ELAPSED_MS']),
  'error':f\"exit {os.environ['EC']}: {os.environ['ERR'][:400]}\"}
with open(f\"{os.environ['OUTBOX']}/mc-agent-{os.environ['CORR']}-error.json\",'w') as f:
    json.dump(out,f,indent=2)
"
        echo "[$(date +%FT%T%z)] error $CORR ec=$EC" >> "$LOG"
    fi

    rm -f "$OUTBOX/mc-agent-${CORR}-running.json"
    rm -f "$f"
done
