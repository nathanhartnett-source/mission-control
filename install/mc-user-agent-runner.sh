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
# Must match OUTBOX_DIR + HISTORY_FILE in lib/agents.ts so the web UI sees
# the runner's responses. The MC service resolves these as MC_DATA_ROOT
# (or process.cwd()/data) — we mirror that here: prefer explicit overrides,
# else MC_DATA_ROOT, else $MC_HOME/data, else $MC_DATA_DIR (legacy var),
# else assume the runner was invoked from the MC install dir.
_DATA_ROOT="${MC_DATA_ROOT:-${MC_HOME:+$MC_HOME/data}}"
_DATA_ROOT="${_DATA_ROOT:-$MC_DATA_DIR}"
_DATA_ROOT="${_DATA_ROOT:-$(pwd)/data}"
OUTBOX="${MC_OUTBOX_DIR:-$_DATA_ROOT/mc-agent-outbox}"
HISTORY_FILE_PATH="${MC_HISTORY_FILE:-$_DATA_ROOT/agent-chat/messages.jsonl}"
STATE_DIR="$HOME/user-workspaces/${USERNAME}"
USER_MEM="$HOME/.claude/projects/-home-${USERNAME}/memory"
LOG="/tmp/mc-user-agent-runner-${USERNAME}.log"
LOCK="/tmp/mc-user-agent-runner-${USERNAME}.lock"
CLAUDE="${CLAUDE_BIN:-$HOME/.npm-global/bin/claude}"
[[ ! -x "$CLAUDE" ]] && CLAUDE="$(command -v claude 2>/dev/null)"

export PATH="$HOME/bin:$HOME/.npm-global/bin:$PATH"

# Feature-detect --effort flag once and cache by claude binary path. Older
# claude CLIs (pre ~Apr 2026) exit 1 when given --effort, which broke the
# runner on installs that hadn't upgraded — see 2026-05-14 incident on Karl's
# VPS. Cache is invalidated automatically if the claude binary path changes.
EFFORT_ARGS=()
if [[ -x "$CLAUDE" ]]; then
    _EFFORT_CACHE="/tmp/.mc-claude-effort-$(echo -n "$CLAUDE" | md5sum | cut -c1-12)"
    if [[ ! -f "$_EFFORT_CACHE" ]]; then
        if "$CLAUDE" --help 2>&1 | grep -q -- "--effort"; then
            echo "1" > "$_EFFORT_CACHE"
        else
            echo "0" > "$_EFFORT_CACHE"
        fi
    fi
    [[ "$(cat "$_EFFORT_CACHE" 2>/dev/null)" == "1" ]] && EFFORT_ARGS=(--effort medium)
fi

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
# MC_HOME/docs is read-only product documentation (handbook + builder guide)
# every agent should be able to consult — added for ALL roles.
ADD_DIRS=("$STATE_DIR" "$USER_MEM" "$HOME/.claude/projects/-home-${USERNAME}" "/tmp")
[[ -d "$MC_HOME/docs" ]] && ADD_DIRS+=("$MC_HOME/docs")
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
export RUNNER_USERNAME="$USERNAME" RUNNER_HISTORY_FILE="$HISTORY_FILE_PATH" RUNNER_OUTBOX="$OUTBOX"
CONTEXT_BLOCK="$(python3 - <<'PY' 2>/dev/null
import json, os, glob
username = os.environ["RUNNER_USERNAME"]
hist = os.environ["RUNNER_HISTORY_FILE"]
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
DOCS_FRAMING=""
if [[ -d "$MC_HOME/docs" ]]; then
    DOCS_FRAMING="

Mission Control product docs are at \`$MC_HOME/docs/\`:
- \`handbook/\` — how to USE Mission Control (chat, projects, todos, wiki, My Apps, settings, roles, FAQ).
- \`builder/\` — how to BUILD apps inside MC (specs, inputs, prompt templates, PDF/charts, sharing, limits).
When ${USERNAME} asks \"how do I…\" about Mission Control, or \"can I build a tool that…\", consult these files BEFORE answering. They are the source of truth for MC's user-facing surface and supersede your training data when they disagree."
fi

# Display-cased name (first letter uppercase) for addressing the user.
# USERNAME stays lowercased for filesystem paths; DISPLAY_NAME is for prose.
DISPLAY_NAME="$(printf '%s' "${USERNAME:0:1}" | tr 'a-z' 'A-Z')${USERNAME:1}"

if [[ "$ROLE" == "client" ]]; then
    ROLE_FRAMING="You are ${AGENT_NAME}, ${DISPLAY_NAME}'s personal AI assistant in Mission Control.

Read your persona file at ${USER_MEM}/persona.md every turn — it tells you your name, tone, and style. Match it consistently.

When you address the user by name, write **${DISPLAY_NAME}** (capitalised), never the lowercase username.

You operate in **client mode**: you can read and edit files in ${DISPLAY_NAME}'s workspace and memory, search the web, and manage their to-do list. You CANNOT run shell commands, install software, or modify system settings. If ${DISPLAY_NAME} asks for something requiring shell access or admin tools, explain politely and suggest they ask the system admin.

Be conversational and brief. Markdown allowed in text chat.${DOCS_FRAMING}"
else
    ROLE_FRAMING="You are ${AGENT_NAME}, ${DISPLAY_NAME}'s personal AI assistant in Mission Control.

Read your persona file at ${USER_MEM}/persona.md every turn — it tells you your name, tone, and style. Match it consistently.

When you address the user by name, write **${DISPLAY_NAME}** (capitalised), never the lowercase username.

You have full access to ${DISPLAY_NAME}'s workspace, scripts, and systems. Investigate before answering — read files, the wiki, the codebase.

Be conversational and brief. Markdown allowed in text chat (NOT in voice mode).

NEVER run whole-filesystem searches (\`find /\`, \`grep -r /\`, \`du /\`, \`ls -R /\`) — always scope to a specific subdir.${DOCS_FRAMING}"
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
    RUNNING_PATH="$OUTBOX/mc-agent-${CORR}-running.json"
    cat > "$RUNNING_PATH" <<JSON
{"schema":"mc-agent-response/v1","corr_id":"$CORR","agent":"me","ts":"$RUN_TS","state":"running"}
JSON

    STREAM_RAW="/tmp/mc-user-agent-runner-${USERNAME}-${CORR}.stream"
    PARSER="${MC_STREAM_PARSER:-/usr/local/bin/mc-agent-stream-parser.py}"
    [[ ! -f "$PARSER" ]] && PARSER="$HOME/bin/mc-agent-stream-parser.py"

    # PID file so /api/agents/me/stop can SIGTERM the in-flight turn's tree.
    PID_PATH="/tmp/mc-agent-${CORR}.pid"
    echo $$ > "$PID_PATH"

    START="$(date +%s)"
    set +e
    # IS_SANDBOX=1 unlocks --permission-mode=bypassPermissions when claude is
    # invoked as root (mission-control.service runs as root on OBT installs).
    # Harmless when PERMISSION_MODE is "default". stream-json + parser drives
    # the live thinking/doing/Stop pillbox in /agents.
    (cd "$STATE_DIR" 2>/dev/null; IS_SANDBOX=1 timeout 600 "$CLAUDE" -p \
        --model claude-opus-4-7 \
        "${EFFORT_ARGS[@]}" \
        "${ADD_DIR_ARGS[@]}" \
        "${ALLOWED_TOOLS_ARGS[@]}" \
        --permission-mode "$PERMISSION_MODE" \
        --output-format stream-json \
        --include-partial-messages \
        --verbose \
        2>"/tmp/mc-user-agent-runner-${USERNAME}.stderr" <<< "$FRAMED_TEXT") \
      | tee "$STREAM_RAW" \
      | RUNNING_PATH="$RUNNING_PATH" CORR="$CORR" AGENT="me" python3 -u "$PARSER" >/dev/null
    EC=${PIPESTATUS[0]}
    set -e
    END="$(date +%s)"
    ELAPSED_MS=$(( (END - START) * 1000 ))
    DONE_TS="$(date -u +%FT%TZ)"

    # Parse the captured stream for final text. (Parser only writes the live
    # state file; final assembly happens here so we don't lose the response if
    # the parser process exits weirdly.)
    RESP=""
    if [[ -s "$STREAM_RAW" ]]; then
        RESP="$(python3 - "$STREAM_RAW" <<'PY' 2>/dev/null
import json, sys
text_parts = []
try:
  with open(sys.argv[1]) as f:
    for line in f:
      line = line.strip()
      if not line: continue
      try: evt = json.loads(line)
      except Exception: continue
      if not isinstance(evt, dict): continue
      ev = evt.get("event")
      if isinstance(ev, dict):
        delta = ev.get("delta")
        if isinstance(delta, dict) and delta.get("type") == "text_delta" and "text" in delta:
          text_parts.append(delta["text"])
      if evt.get("type") == "result" and isinstance(evt.get("result"), str) and not text_parts:
        text_parts.append(evt["result"])
except Exception:
  pass
print("".join(text_parts).strip())
PY
)"
    fi
    rm -f "$STREAM_RAW" "$PID_PATH"

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
