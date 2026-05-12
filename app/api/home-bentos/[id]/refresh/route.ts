import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/elements-auth";
import { getBento, updateBento } from "@/lib/home-bentos";
import { listMessages } from "@/lib/inbox";
import { listElements } from "@/lib/elements";
import { listDataAlerts } from "@/lib/data-alerts";
import { runUserClaude } from "@/lib/user-claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/home-bentos/[id]/refresh — runs Sonnet (with web search) against
// the bento's prompt + a small dashboard context bundle, stores the markdown
// result on the bento. Synchronous: returns the new result when done.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  const bento = getBento(auth.username, id);
  if (!bento) return NextResponse.json({ error: "not found" }, { status: 404 });

  updateBento(auth.username, id, { refreshing: true, lastError: null });

  const recentInbox = listMessages(auth.username, { limit: 10 }).map((m) => `- [${m.level || "info"}] ${m.read ? "" : "(unread) "}${m.subject}${m.body ? " — " + m.body.replace(/\s+/g, " ").slice(0, 200) : ""} (${m.from}, ${m.ts})`).join("\n") || "(no inbox messages)";
  const elements = listElements(auth.username).slice(0, 12).map((e) => `- ${e.name}${e.description ? ": " + e.description : ""}`).join("\n") || "(none)";
  const alerts = listDataAlerts(auth.username).map((a) => {
    const desc = a.kind === "research" ? `Research alert: ${a.prompt || ""}` : `${a.source || ""}${a.dims?.brand ? " · " + a.dims.brand : ""} ${a.op || ""} ${a.threshold ?? ""}`;
    const lastFired = a.lastFiredAt ? `last fired ${a.lastFiredAt}` : "never fired";
    const lastVal = a.lastValue != null ? ` · last value ${a.lastValue}` : "";
    return `- [${a.active ? "ON" : "off"}] ${a.label || a.id} — ${desc} (${lastFired}${lastVal})`;
  }).join("\n") || "(no alerts configured)";

  const prompt = `You are powering a small "bento" card on a user's dashboard home page. The user has asked for this card to display:

USER REQUEST:
${bento.prompt}

LIGHT DASHBOARD CONTEXT (for reference if relevant — ignore if the request is about external information):

Recent inbox messages (last 10, the user's "alerts" land here when they fire):
${recentInbox}

Configured alerts (from /alerts page — these are the rules; their triggers go to inbox):
${alerts}

User's custom apps:
${elements}

If the user is asking about "alerts" or "latest alerts", they almost certainly mean the inbox messages and/or the configured alerts above — NOT external news or Discord. Use the dashboard data, not web search.

INSTRUCTIONS:
- Produce a CONCISE markdown response that fits in a small dashboard tile (~6-12 lines max).
- Use web search if the request needs current external information (news, regulatory updates, market info).
- Lead with the most important takeaway. Use bullet points or short paragraphs.
- Bold key numbers / names with **bold**.
- If you can't reasonably answer, say so in one sentence.
- Do NOT include preamble like "Here's what I found" or "Based on your request" — just the content.

Respond with ONLY the markdown content of the card. No JSON, no fences, no commentary.`;

  const result = runUserClaude({ prompt, username: auth.username, model: "opus" });
  const raw = result.stdout;

  if (!raw) {
    const err = result.stderr.slice(0, 200) || `exit ${result.exitCode}`;
    const updated = updateBento(auth.username, id, { refreshing: false, lastError: err, lastUpdated: new Date().toISOString() });
    return NextResponse.json({ bento: updated, error: err }, { status: 500 });
  }

  const updated = updateBento(auth.username, id, {
    result: raw.slice(0, 8000),
    refreshing: false,
    lastError: null,
    lastUpdated: new Date().toISOString(),
  });
  return NextResponse.json({ bento: updated });
}
