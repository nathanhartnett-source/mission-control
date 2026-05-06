#!/usr/bin/env bash
# Slim OBT "me" agent runner. Drains the user's MC inbox, calls `claude -p`
# as the current user (root on OBT, OAuth'd via Claude Code), writes a done
# envelope to the shared outbox. Mirrors the envelope format consumed by
# lib/agents.ts (mc-agent-response/v1).
#
# Install: copy to /usr/local/bin/mc-user-agent-runner.sh and set
#   MC_RUNNER_ME=/usr/local/bin/mc-user-agent-runner.sh in MC's env.

set -euo pipefail

USERNAME="${1:-}"
[[ -z "$USERNAME" ]] && { echo "usage: $0 <username>" >&2; exit 2; }

HOME_DIR="${HOME:-/root}"
INBOX="$HOME_DIR/.claude/channels/user-${USERNAME}/inbox"
OUTBOX="$HOME_DIR/wiki/_outbox/mc-agent"
LOG="$HOME_DIR/.claude/logs/mc-user-agent-runner-${USERNAME}.log"
LOCK="/tmp/mc-user-agent-runner-${USERNAME}.lock"
CLAUDE="$(command -v claude || echo /usr/bin/claude)"

mkdir -p "$OUTBOX" "$(dirname "$LOG")"

# Single-flight per user.
exec 9>"$LOCK"
flock -n 9 || exit 0

[[ -d "$INBOX" ]] || exit 0

shopt -s nullglob
for INFILE in "$INBOX"/mc-agent-me-*.json; do
    [[ -f "$INFILE" ]] || continue
    CORR="$(basename "$INFILE" .json)"
    CORR="${CORR#mc-agent-me-}"

    TEXT="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("text",""))' "$INFILE" 2>/dev/null || echo "")"
    [[ -z "$TEXT" ]] && { rm -f "$INFILE"; continue; }

    RUN_TS="$(date -u +%FT%TZ)"
    cat > "$OUTBOX/mc-agent-${CORR}-running.json" <<JSON
{"schema":"mc-agent-response/v1","corr_id":"$CORR","agent":"me","ts":"$RUN_TS","state":"running"}
JSON

    START="$(date +%s)"
    STDERR="/tmp/mc-user-agent-runner-${USERNAME}.stderr"
    set +e
    RESP="$(IS_SANDBOX=1 timeout 600 flock -w 600 /tmp/claude-subagent.lock "$CLAUDE" -p \
        --model claude-opus-4-7 \
        --permission-mode bypassPermissions \
        2>"$STDERR" <<<"$TEXT")"
    EC=$?
    set -e
    END="$(date +%s)"
    ELAPSED_MS=$(( (END - START) * 1000 ))
    DONE_TS="$(date -u +%FT%TZ)"

    if [[ $EC -eq 0 && -n "$RESP" ]]; then
        export CORR DONE_TS RESP ELAPSED_MS OUTBOX
        python3 - <<'PY'
import json, os
out = {
  "schema": "mc-agent-response/v1",
  "corr_id": os.environ["CORR"],
  "agent": "me",
  "ts": os.environ["DONE_TS"],
  "state": "done",
  "text": os.environ["RESP"],
  "elapsed_ms": int(os.environ["ELAPSED_MS"]),
  "memory_saved": [],
  "thinking_events": [],
  "delegations": [],
  "error": None,
}
with open(os.path.join(os.environ["OUTBOX"], f"mc-agent-{os.environ['CORR']}-done.json"), "w") as f:
    json.dump(out, f, indent=2)
PY
        echo "[$(date +%FT%T%z)] done $CORR in ${ELAPSED_MS}ms" >> "$LOG"
    else
        ERR="$(tail -c 500 "$STDERR" 2>/dev/null || echo "exit $EC")"
        export CORR DONE_TS ERR ELAPSED_MS EC OUTBOX
        python3 - <<'PY'
import json, os
out = {
  "schema": "mc-agent-response/v1",
  "corr_id": os.environ["CORR"],
  "agent": "me",
  "ts": os.environ["DONE_TS"],
  "state": "error",
  "elapsed_ms": int(os.environ["ELAPSED_MS"]),
  "error": f"exit {os.environ['EC']}: {os.environ['ERR'][:400]}",
}
with open(os.path.join(os.environ["OUTBOX"], f"mc-agent-{os.environ['CORR']}-error.json"), "w") as f:
    json.dump(out, f, indent=2)
PY
        echo "[$(date +%FT%T%z)] error $CORR ec=$EC" >> "$LOG"
    fi

    rm -f "$INFILE" "$OUTBOX/mc-agent-${CORR}-running.json"
done
