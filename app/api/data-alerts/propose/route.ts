import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "child_process";
import { requireUser } from "@/lib/elements-auth";
import { ALERT_SOURCES } from "@/lib/alert-sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Msg = { role: "user" | "assistant"; content: string };

// POST /api/data-alerts/propose
// Body: { messages: [{role,content},...], currentAlert?: {...} }
// Returns: { reply: string, alert?: {...}, ready: boolean, kind?: "data"|"research" }
//   ready=true means the user said "save"/"do it" and the spec is final.
export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => ({}));
  const messages: Msg[] = Array.isArray(body?.messages) ? body.messages.filter((m: { role?: string; content?: string }) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string").map((m: { role: string; content: string }) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 4000) })) : [];
  if (messages.length === 0) return NextResponse.json({ error: "messages required" }, { status: 400 });
  const currentAlert = body?.currentAlert && typeof body.currentAlert === "object" ? body.currentAlert : null;

  const sourcesDescription = ALERT_SOURCES.map((s) => {
    const dims = s.dimensions.length
      ? "\n    Dimensions:" + s.dimensions.map((d) => `\n      - ${d.key}: one of ${d.choices.map((c) => c.value).join(", ")}`).join("")
      : "";
    return `  - id: ${s.id}\n    label: ${s.label}\n    description: ${s.description}\n    ops: ${s.ops.join(", ")}\n    unit: ${s.unit}${dims}`;
  }).join("\n");

  const transcript = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

  const systemPrompt = `You are an alert-setup assistant. You help the user create or edit an alert through natural conversation. The user describes what they want to be alerted about; you propose a structured spec under the hood AND reply in plain English describing what the alert will do.

There are TWO kinds of alert:

═══ KIND 1: DATA ALERTS ═══
Watches dashboard metrics (PSI scores, sales revenue, order counts). Cron fires every 30 min, fetches current values, hands them to a Sonnet judge with the user's "intent", judge decides whether to fire and crafts the inbox body.

AVAILABLE DATA SOURCES (the cron can fetch these):
${sourcesDescription}

Note: PSI data is page-level (home / cat / pdp × mobile/desktop × brand). The judge sees per-page rows, so "alert me if any page drops below 80" works — put that in intent.

═══ KIND 2: RESEARCH ALERTS ═══
For "alert me when something happens in the world" — runs a Claude web search on a schedule. Use for regulatory updates, industry news, competitor announcements, product launches, security advisories — anything requiring a live web search rather than dashboard data.

═══ YOUR JOB ═══
Read the conversation. Decide what the user wants. ${currentAlert ? "There is an EXISTING ALERT being edited — see CURRENT ALERT below. Update it based on the conversation; don't start from scratch." : ""}

Always respond with ONLY this JSON object (no prose, no markdown fences):

{
  "reply": "<conversational plain-English reply to the user. Tell them what you'll do (or already did), or ask a clarifying question if their request is ambiguous. Do NOT mention 'source ids', 'op', 'threshold', 'intent', 'JSON' — keep it in user language.>",
  "ready": <true if the user clearly said 'save'/'create'/'do it'/'looks good'/'yes please' AND you have enough info; otherwise false>,
  "alert": {
    "kind": "<data|research>",
    "label": "<short human label, e.g. 'PSI drop watch'>",
    "summary": "<one-line plain-English description of what this alert does, shown in the user's alerts list — e.g. 'Alerts you when any page across all brands drops below 80 on mobile PSI, with reasons + suggested fixes.'>",
    // FOR data alerts:
    "intent": "<full natural-language brief for the cron's AI judge — what to flag, what to ignore, what to include in the inbox message (analysis, recommendations, etc.). Capture EVERYTHING the user said about WHEN to fire and WHAT to include.>",
    "source": "<one of the source ids above>",
    "dims": { "brand": "<a brand id, or 'all'>" },
    "op": "<,<=,>,>=",
    "threshold": <number — hint for the judge>,
    "minConsecutiveSamples": <int 1-20>,
    "cooldownHours": <int 1-168>,
    // FOR research alerts:
    "prompt": "<concrete web-research instruction>",
    "frequencyHours": <int 1-168>
    // (only the fields relevant to the chosen kind need to be filled)
  }
}

GUIDELINES:
- Always provide an alert object reflecting your CURRENT best understanding, even when ready=false — the UI shows the user a live summary while they refine.
- If the user's first message is enough to set the alert up confidently, you may set ready=true on the first turn. Otherwise default ready=false and ask one short clarifying question OR confirm what you've understood.
- ${currentAlert ? "When editing, preserve fields the user didn't ask to change." : "Use sensible defaults: cooldownHours 24, minConsecutiveSamples 1 (or what the user implied), frequencyHours 24 for research."}
- If the user asks for something impossible (no matching data source, contradictory rules) — set ready=false, omit alert, and explain in reply.

${currentAlert ? `═══ CURRENT ALERT (being edited) ═══
${JSON.stringify(currentAlert, null, 2)}

` : ""}═══ CONVERSATION SO FAR ═══
${transcript}`;

  const CLAUDE_BIN = process.env.CLAUDE_BIN || "/home/nathan/.npm-global/bin/claude";
  const result = spawnSync(CLAUDE_BIN, ["-p", "--model", "claude-sonnet-4-6"], {
    input: systemPrompt,
    encoding: "utf8",
    timeout: 55000,
    maxBuffer: 1024 * 1024,
  });

  const raw = (result.stdout || "").trim();
  if (!raw) {
    const stderr = (result.stderr || "").trim().slice(0, 300);
    const code = result.status;
    return NextResponse.json({ reply: `Sorry — the AI didn't respond (exit=${code}${stderr ? `, err: ${stderr}` : ""}). Try again.`, ready: false });
  }

  let parsed: { reply?: string; ready?: boolean; alert?: Record<string, unknown> } | null = null;
  try { parsed = JSON.parse(raw); }
  catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
  }
  if (!parsed) {
    return NextResponse.json({ reply: "Couldn't parse my response — please rephrase.", ready: false });
  }

  // Validate alert if present and ready
  if (parsed.alert && parsed.ready) {
    const a = parsed.alert as Record<string, unknown>;
    const kind = (a.kind as string) || "data";
    if (kind === "data") {
      const validSource = ALERT_SOURCES.find((s) => s.id === a.source);
      if (!validSource || !["<", "<=", ">", ">="].includes(a.op as string) || !Number.isFinite(Number(a.threshold))) {
        return NextResponse.json({ reply: parsed.reply || "I need a bit more info — could you confirm what to watch and the threshold?", alert: parsed.alert, ready: false });
      }
    } else if (kind === "research") {
      if (typeof a.prompt !== "string" || a.prompt.length < 10 || !Number.isFinite(Number(a.frequencyHours))) {
        return NextResponse.json({ reply: parsed.reply || "I need a bit more detail about what to search for and how often.", alert: parsed.alert, ready: false });
      }
    }
  }

  return NextResponse.json(parsed);
}
