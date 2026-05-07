#!/usr/bin/env python3
"""
mc-agent-stream-parser.py — consumes claude -p --output-format stream-json on
stdin and live-updates $RUNNING_PATH (running.json) with:
  - thinking_events: list of {kind:"thinking", text, ts} for the chat thinking pane
  - last_event_ts:   ISO-Z stamp of the most recent stream event (any kind)
  - activity_kind:   "thinking" | "doing"
                     Sticky to "doing" once a mutating tool fires this turn.
  - current_tool:    name of the in-flight tool_use, or null.
  - current_tool_summary: ~30-40 char human-readable line of what the tool is
                          doing (e.g. "Edit lib/agents.ts", "Bash: npm run build")
                          — derived from the streamed input_json, surfaces in
                          the expandable disclosure in the chat row.

Designed to be invoked from mc-agent-runner.sh once per task. Reads the
following env vars:
    RUNNING_PATH — absolute path to running.json
    CORR         — correlation id
    AGENT        — agent name (ava/mia/overseer)
"""
import json
import os
import sys
import time
import datetime

# Tools that don't change anything outside the agent. Anything NOT in this set
# flips activity_kind to "doing" so Nathan can intervene if a question-only
# prompt unexpectedly starts mutating files. Bash is intentionally NOT here —
# bash is most often used to run things that have effect (deploys, wp-cli,
# curl POSTs), so it's safer to flag it as "doing" than to miss a write.
READ_ONLY_TOOLS = {
    "Read", "Grep", "Glob",
    "WebFetch", "WebSearch",
    "ToolSearch",
    "TaskList", "TaskGet", "TaskOutput",
    "Skill",
}

SUMMARY_MAX = 40


def _short_path(p: str) -> str:
    if not isinstance(p, str):
        return ""
    # Strip leading $HOME and common project prefixes for compactness.
    home = os.environ.get("HOME", "")
    if home and p.startswith(home):
        p = "~" + p[len(home):]
    parts = p.split("/")
    if len(parts) > 4:
        p = ".../" + "/".join(parts[-3:])
    return p


def _truncate(s: str, n: int = SUMMARY_MAX) -> str:
    if len(s) <= n:
        return s
    return s[: n - 1] + "…"


def summarise_tool(name: str, inp) -> str:
    """Build a 30-40 char one-liner describing what the tool is about to do.

    `inp` may be a partial dict (input streams in deltas — we may have only a
    field or two by the time we render). Always returns *something* even with
    empty input so the disclosure has content the moment it's expanded.
    """
    if not isinstance(inp, dict):
        inp = {}
    n = name or "Tool"
    if n == "Read":
        return _truncate(f"Read {_short_path(inp.get('file_path', ''))}".strip())
    if n == "Edit":
        return _truncate(f"Edit {_short_path(inp.get('file_path', ''))}".strip())
    if n == "Write":
        return _truncate(f"Write {_short_path(inp.get('file_path', ''))}".strip())
    if n == "Bash":
        cmd_raw = (inp.get("command") or "").strip()
        if not cmd_raw:
            return "Bash"
        cmd = " ".join(cmd_raw.splitlines()[0].split())
        return _truncate(f"Bash: {cmd}")
    if n == "Grep":
        pat = inp.get("pattern") or ""
        return _truncate(f"Grep: {pat}".strip())
    if n == "Glob":
        return _truncate(f"Glob {inp.get('pattern', '')}".strip())
    if n == "WebFetch":
        url = inp.get("url") or ""
        # show host only
        try:
            host = url.split("//", 1)[-1].split("/", 1)[0]
        except Exception:
            host = url
        return _truncate(f"Fetch {host}".strip())
    if n == "WebSearch":
        return _truncate(f"Search: {inp.get('query', '')}".strip())
    if n == "Task" or n == "Agent":
        return _truncate(f"Subagent: {inp.get('description', inp.get('subagent_type', ''))}".strip())
    if n == "Skill":
        return _truncate(f"Skill: {inp.get('skill', '')}".strip())
    if n == "NotebookEdit":
        return _truncate(f"NotebookEdit {_short_path(inp.get('notebook_path', ''))}".strip())
    if n == "ToolSearch":
        return _truncate(f"ToolSearch: {inp.get('query', '')}".strip())
    return _truncate(n)


running_path = os.environ["RUNNING_PATH"]
corr_id = os.environ["CORR"]
agent = os.environ["AGENT"]

think_buf = []          # accumulating chars for current thinking block
events = []             # closed thinking blocks
last_write = 0.0
last_event_ts = datetime.datetime.utcnow().isoformat() + "Z"
activity_kind = "thinking"  # sticky to "doing" once a mutating tool fires
current_tool = None
# current_tool_summary is STICKY across non-tool blocks: once a tool's summary
# has been derived, it persists until the next tool starts, so the UI can show
# "Edit lib/agents.ts (3s ago)" while the agent is in a between-tool thinking
# or text phase. Cleared only on message_stop / when next tool starts.
current_tool_summary = None
current_tool_summary_ts = None  # ISO-Z when current_tool_summary was last updated
# Streaming tool input is sent as JSON deltas. Accumulate the partial JSON for
# the in-flight tool block and re-derive the summary as fields land.
tool_input_buf = ""


def utcnow():
    return datetime.datetime.utcnow().isoformat() + "Z"


def write_state(force=False):
    """Write running.json. Throttled to 0.4s unless force=True.

    Always writes — even when no thinking events yet — so the frontend can
    watch last_event_ts for freshness/stuck detection.
    """
    global last_write
    now = time.time()
    if not force and now - last_write < 0.4:
        return
    last_write = now
    out = list(events)
    if think_buf:
        out.append({
            "kind": "thinking",
            "text": "".join(think_buf).strip(),
            "ts": utcnow(),
        })
    state = {
        "schema": "mc-agent-response/v1",
        "corr_id": corr_id,
        "agent": agent,
        "ts": utcnow(),
        "state": "running",
        "thinking_events": out,
        "last_event_ts": last_event_ts,
        "activity_kind": activity_kind,
        "current_tool": current_tool,
        "current_tool_summary": current_tool_summary,
        "current_tool_summary_ts": current_tool_summary_ts,
    }
    tmp = running_path + ".tmp"
    try:
        with open(tmp, "w") as f:
            json.dump(state, f, indent=2)
        os.rename(tmp, running_path)
    except Exception:
        pass


def close_thinking():
    if think_buf:
        events.append({
            "kind": "thinking",
            "text": "".join(think_buf).strip(),
            "ts": utcnow(),
        })
        think_buf.clear()
        write_state(force=True)


def try_refresh_summary():
    """Best-effort parse of partial tool_input_buf to refresh the summary."""
    global current_tool_summary, current_tool_summary_ts
    if current_tool is None:
        return
    parsed = None
    s = tool_input_buf.strip()
    if s:
        try:
            parsed = json.loads(s)
        except Exception:
            # Tail-pad the partial JSON so a single missing closer parses.
            for tail in ('"}', '}', '"]', ']'):
                try:
                    parsed = json.loads(s + tail)
                    break
                except Exception:
                    continue
    new_summary = summarise_tool(current_tool, parsed or {})
    if new_summary != current_tool_summary:
        current_tool_summary = new_summary
        current_tool_summary_ts = utcnow()


for line in sys.stdin:
    s = line.strip()
    if not s:
        continue
    try:
        evt = json.loads(s)
    except Exception:
        continue
    if not isinstance(evt, dict):
        continue

    last_event_ts = utcnow()

    ev = evt.get("event")
    if isinstance(ev, dict):
        evt_type = ev.get("type")
        delta = ev.get("delta")
        if isinstance(delta, dict):
            t = delta.get("type")
            if t == "thinking_delta" and "thinking" in delta:
                think_buf.append(delta["thinking"])
            elif t == "text_delta":
                close_thinking()
            elif t == "input_json_delta" and current_tool is not None:
                # Tool input arrives in fragments — accumulate then re-derive.
                tool_input_buf += delta.get("partial_json", "")
                try_refresh_summary()
        if evt_type == "content_block_start":
            close_thinking()
            block = ev.get("content_block")
            if isinstance(block, dict) and block.get("type") == "tool_use":
                name = block.get("name") or ""
                current_tool = name
                tool_input_buf = ""
                # Set an immediate placeholder summary in case input_json never streams.
                current_tool_summary = summarise_tool(name, {})
                current_tool_summary_ts = utcnow()
                if name and name not in READ_ONLY_TOOLS:
                    activity_kind = "doing"
            else:
                # Text or thinking block — the active tool's input is fully sent.
                # We clear `current_tool` (so the pill stops claiming a tool is
                # active), but KEEP `current_tool_summary` sticky so the UI can
                # display "last action: Edit lib/agents.ts (3s ago)" while the
                # model thinks about the result or composes a reply.
                current_tool = None
                tool_input_buf = ""
        # NOTE: content_block_stop fires when claude finishes WRITING the tool's
        # input, not when the tool finishes executing. Don't clear current_tool
        # here — it'd false-resolve to None while a slow Bash/Edit tool is still
        # running, making the pill flip red prematurely. Clearing happens above
        # on the next non-tool content_block_start, or below on message_stop.
        if evt_type == "message_stop":
            current_tool = None
            tool_input_buf = ""

    write_state()

# Final flush so the closing state matches reality.
close_thinking()
write_state(force=True)
