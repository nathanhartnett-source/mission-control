# Mission Control Dashboard — Build Spec

## Goal
A clean Next.js 14 (App Router) dashboard that shows:
1. What API/model OpenClaw is currently using (ACCURATE)
2. Estimated token usage today (from session files, clearly labeled as estimated)
3. Plan limits reference card (Claude Pro vs OpenAI Plus — static data)

## Tech Stack
- Next.js 14 with App Router, TypeScript, Tailwind CSS
- Server-side file reads (Node.js fs) — no external APIs
- Auto-refresh every 30 seconds (client-side polling)

## Data Sources (all local files)

### Current Model (ACCURATE)
Read: `~/.openclaw/agents/main/sessions/sessions.json`
```json
{
  "agent:main:main": {
    "sessionFile": "/home/nathan/.openclaw/agents/main/sessions/4e661028-12ff-43f7-b0bf-25af0b323bac.jsonl",
    ...
  }
}
```
Then read the sessionFile JSONL. Each line is JSON. Find the LAST occurrence of:
- `type: "model_change"` → has `provider` and `modelId` fields
- `type: "custom"` with `customType: "model-snapshot"` → has `data.provider`, `data.modelId`, `data.modelApi`

The last model_change event gives the current model.

Also read `~/.openclaw/openclaw.json` for configured primary model:
```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-sonnet-4-6"
      }
    }
  }
}
```

### Session Info
From `sessions.json`:
- Session ID
- `updatedAt` timestamp
- `lastChannel` (telegram, web, etc.)

From the JSONL:
- `type: "session"` event → `timestamp` is when the session started
- Count of `type: "message"` events → message count

### Estimated Token Usage
Parse ALL session JSONL files under `~/.openclaw/agents/main/sessions/`
that were updated today (use file mtime or parse session start timestamp).

For each message in the JSONL:
- `message.role === "user"` → count characters in content text → divide by 4 → input tokens estimate
- `message.role === "assistant"` → count characters in content text (excluding thinking blocks) → divide by 4 → output tokens estimate

This is rough but honest. Label it "~estimated".

Also sum across:
- main agent sessions
- mia agent: `~/.openclaw/agents/mia/sessions/` (if exists)
- cassie agent: `~/.openclaw/agents/cassie/sessions/` (if exists)

### Plan Limits Reference (STATIC DATA — hardcode this)
```
Claude Pro ($20/month):
- Model: claude-sonnet-4-6, claude-3-5-haiku, claude-opus-4
- Context window: 200k tokens per request
- Daily limit: ~5–10M tokens (no hard limit; Anthropic fair use)
- Rate limit: ~500 requests/hour (approximate)
- Best for: long context, complex reasoning, coding

OpenAI Plus ($20/month) + Codex:
- ChatGPT: 80 GPT-4o messages per 3 hours
- Codex API: credit-based ($5 free → then pay per use)
- gpt-5.2-codex: ~$3/1M input, ~$12/1M output
- gpt-5.2-codex-mini: ~$0.60/1M input, ~$2.40/1M output (5x cheaper)
- Best for: autonomous coding tasks
```

## API Route

### GET /api/status
Returns JSON:
```json
{
  "currentModel": {
    "provider": "anthropic",
    "modelId": "claude-sonnet-4-6",
    "displayName": "Claude Sonnet 4.6",
    "source": "session"  // "session" | "config"
  },
  "session": {
    "id": "4e661028-...",
    "startedAt": "2026-02-20T04:17:52.155Z",
    "updatedAt": 1771561455391,
    "lastChannel": "telegram",
    "messageCount": 42
  },
  "tokenEstimate": {
    "inputTokensToday": 125000,
    "outputTokensToday": 45000,
    "totalTokensToday": 170000,
    "sessionCount": 2,
    "note": "estimated from character count / 4"
  },
  "timestamp": "2026-02-20T04:26:00.000Z"
}
```

## UI Layout

### Header
- Title: "Mission Control"
- Subtitle: "OpenClaw Agent Status"
- Last updated: "Updated just now" (relative time)
- Refresh button

### Row 1: Current API Card (full width)
Big prominent card showing:
- 🤖 Provider logo/icon (Anthropic = purple, OpenAI = green)
- Model name (e.g. "claude-sonnet-4-6")
- Provider (e.g. "Anthropic")
- Source: "Active session" or "Config"
- Session started: "2 hours ago"
- Messages this session: 42
- Last channel: Telegram

### Row 2: Two cards side by side

**Card: Today's Usage (left)**
- Input tokens: ~125,000
- Output tokens: ~45,000  
- Total: ~170,000
- Shown as a progress bar vs plan limit
- Label: "⚠️ Estimated from message content (÷4)"
- Sessions today: 2

**Card: Session Health (right)**
- Context window: [progress bar] 38k / 200k (19%)
- Session ID (truncated)
- Started: "X hours ago"
- Updated: "2 minutes ago"

### Row 3: Plan Limits Reference (full width)
A two-column comparison table:

| Feature | Claude Pro | OpenAI Plus + Codex |
|---------|------------|---------------------|
| Price | $20/month | $20/month + credits |
| Models | claude-sonnet-4-6, opus-4, haiku | gpt-5.2-codex, gpt-4o, mini |
| Context | 200k tokens | 128k tokens |
| Daily token budget | ~5–10M (fair use) | $5 free credits |
| Rate limit | ~500 req/hr | 80 msg/3hr (ChatGPT) |
| Best for | Long context, reasoning | Coding automation |
| Current | ✅ Active | ⬜ Inactive |

### Footer
- "Data read from ~/.openclaw — no external calls"
- Version: OpenClaw 2026.2.19-2

## Styling
- Dark theme (bg-gray-950, cards bg-gray-900)
- Anthropic = purple accents (#7C3AED)
- OpenAI = green accents (#10B981)
- Current provider gets highlighted accent
- Clean, minimal, no animations (just refresh)
- Mobile-friendly

## File Structure
```
mission-control/
  app/
    page.tsx           # Main dashboard (client component with polling)
    layout.tsx         # Root layout
    api/
      status/
        route.ts       # Server: reads OpenClaw files
  components/
    CurrentModelCard.tsx
    TokenUsageCard.tsx
    SessionHealthCard.tsx
    PlanLimitsTable.tsx
  lib/
    openclaw-reader.ts  # All file reading logic
  package.json
  tailwind.config.ts
  next.config.ts
  tsconfig.json
```

## Important Notes
1. ALL file reads happen server-side in route.ts — no client-side file access
2. Handle missing files gracefully (agents/mia may not exist)
3. The "current model" section is the most important — get it right from JSONL
4. Use `fs.existsSync` before reading anything, return null/defaults if missing
5. The home directory is `/home/nathan` — hardcode this or use `os.homedir()`
6. Token estimates: only count today's sessions (compare session timestamp date to today)

## Startup
- `npm run dev` → runs on port 3001 (set PORT=3001 in package.json dev script)
- When done, notify: `openclaw system event --text "Mission Control built: npm run dev in ~/workspace/mission-control" --mode now`
