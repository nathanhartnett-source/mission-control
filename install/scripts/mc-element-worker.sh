#!/usr/bin/env bash
# mc-element-worker.sh <username> <runDir> <timeoutMin>
# stdin = the rendered prompt
#
# Runs claude -p with a restricted toolset (web + read-only filesystem).
# Writes streaming output to <runDir>/output.md, then `done` or `error` marker.
set -uo pipefail

USERNAME="${1:?username required}"
RUN_DIR="${2:?runDir required}"
TIMEOUT_MIN="${3:-30}"

mkdir -p "$RUN_DIR"
OUT="$RUN_DIR/output.md"
LOG="$RUN_DIR/worker.log"
ERR="$RUN_DIR/error"

PROMPT_FILE="$RUN_DIR/prompt.txt"
cat > "$PROMPT_FILE"

# Restricted tools: web + read-only filesystem only. No Write/Edit/Bash.
ALLOWED="WebSearch WebFetch Read Glob Grep TodoWrite"

# Claude CLI lookup — try $CLAUDE_BIN, then PATH, then common npm-global
# locations. The MC systemd unit's PATH doesn't include ~/.npm-global/bin
# where claude actually lives, so a bare `command -v claude` from the
# spawned worker fails. Explicit fallbacks fix this without needing a
# systemd unit edit.
if [ -z "${CLAUDE_BIN:-}" ]; then
    CLAUDE_BIN="$(command -v claude 2>/dev/null || true)"
fi
if [ -z "$CLAUDE_BIN" ]; then
    for candidate in \
        "$HOME/.npm-global/bin/claude" \
        "/usr/local/bin/claude" \
        "/root/.npm-global/bin/claude"
    do
        if [ -x "$candidate" ]; then
            CLAUDE_BIN="$candidate"
            break
        fi
    done
fi
if [ -z "$CLAUDE_BIN" ]; then
  echo "claude CLI not found (checked \$CLAUDE_BIN, PATH, ~/.npm-global/bin, /usr/local/bin, /root/.npm-global/bin)" > "$ERR"
  exit 1
fi

# Run with timeout. Use a fresh cwd in /tmp so the worker has no project context.
WORK_CWD="$(mktemp -d -t mc-element-XXXXXX)"

{
  echo "[$(date -Iseconds)] start: user=$USERNAME run=$RUN_DIR timeout=${TIMEOUT_MIN}m"
  echo "[$(date -Iseconds)] cwd=$WORK_CWD allowed=$ALLOWED"
} >> "$LOG"

cd "$WORK_CWD" || { echo "cd failed" > "$ERR"; exit 1; }

# Use Opus 4.7. Pass --permission-mode bypassPermissions so it doesn't pause for
# tool confirmations, but the allowed-tools list still bounds what it CAN call.
timeout "${TIMEOUT_MIN}m" "$CLAUDE_BIN" \
  -p \
  --model claude-opus-4-7 \
  --output-format text \
  --permission-mode bypassPermissions \
  --allowedTools "$ALLOWED" \
  < "$PROMPT_FILE" \
  > "$OUT" 2>> "$LOG"
RC=$?

# Cap output at 2MB
if [ -f "$OUT" ]; then
  SIZE=$(stat -c%s "$OUT" 2>/dev/null || echo 0)
  if [ "$SIZE" -gt 2000000 ]; then
    head -c 2000000 "$OUT" > "$OUT.tmp" && mv "$OUT.tmp" "$OUT"
    echo -e "\n\n_(output truncated at 2MB)_" >> "$OUT"
  fi
fi

rm -rf "$WORK_CWD" 2>/dev/null

if [ $RC -eq 0 ]; then
  # If the spec snapshot says outputFormat=pdf, render the PDF before marking done.
  SPEC_JSON="$RUN_DIR/spec.json"
  if [ -f "$SPEC_JSON" ] && grep -q '"outputFormat"[[:space:]]*:[[:space:]]*"pdf"' "$SPEC_JSON"; then
    PDF_RENDER="${MC_PDF_RENDER:-/usr/local/bin/mc-element-pdf-render.cjs}"
    if [ -x "$PDF_RENDER" ] || [ -f "$PDF_RENDER" ]; then
      echo "[$(date -Iseconds)] rendering PDF via $PDF_RENDER" >> "$LOG"
      if node "$PDF_RENDER" "$RUN_DIR" "$SPEC_JSON" >> "$LOG" 2>&1; then
        echo "[$(date -Iseconds)] PDF render ok" >> "$LOG"
      else
        echo "[$(date -Iseconds)] PDF render FAILED — keeping markdown output" >> "$LOG"
      fi
    else
      echo "[$(date -Iseconds)] PDF renderer not found at $PDF_RENDER — markdown only" >> "$LOG"
    fi
  fi
  touch "$RUN_DIR/done"
  echo "[$(date -Iseconds)] done rc=0" >> "$LOG"
elif [ $RC -eq 124 ]; then
  echo "Worker hit ${TIMEOUT_MIN}-minute timeout" > "$ERR"
  echo "[$(date -Iseconds)] timeout rc=$RC" >> "$LOG"
else
  echo "Worker exited rc=$RC. Last log lines:" > "$ERR"
  tail -n 20 "$LOG" >> "$ERR" 2>/dev/null || true
  echo "[$(date -Iseconds)] failed rc=$RC" >> "$LOG"
fi
