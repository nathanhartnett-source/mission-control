import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/elements-auth";
import { getDataAlert } from "@/lib/data-alerts";
import { postMessage } from "@/lib/inbox";
import { runUserClaude } from "@/lib/user-claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/data-alerts/[id]/test
// Asks the AI to synthesize a realistic triggered scenario for this alert
// and drops a SAMPLE message into the user's inbox so they can see the format.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  const alert = getDataAlert(auth.username, id);
  if (!alert) return NextResponse.json({ error: "not found" }, { status: 404 });

  const brief = alert.kind === "research" ? (alert.prompt || "") : (alert.intent || "");
  const prompt = `You are an alert-system tester. The user wants to see what a real triggered alert would look like for the following alert.

ALERT SUMMARY: ${alert.summary || alert.label || "(no summary)"}
ALERT BRIEF: ${brief}

Synthesize a REALISTIC plausible triggered scenario and craft the inbox message body. Use plausible-looking numbers, brand names, URLs. Markdown OK. Include any analysis/recommendations the brief asks for.

Respond with ONLY this JSON (no prose, no markdown fences):
{
  "subject": "<short subject>",
  "body": "<inbox message body, markdown OK>"
}`;

  const r = runUserClaude({ prompt, username: auth.username, model: "opus", timeoutMs: 55000 });
  const raw = r.stdout;
  let parsed: { subject?: string; body?: string } | null = null;
  if (raw) {
    try { parsed = JSON.parse(raw); }
    catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) try { parsed = JSON.parse(m[0]); } catch {}
    }
  }
  if (!parsed) return NextResponse.json({ error: "AI didn't return a usable sample" }, { status: 500 });

  postMessage(auth.username, {
    from: "Alerts (sample)",
    subject: `[SAMPLE] ${parsed.subject || alert.label || "Alert"}`,
    body: `_This is a sample showing what this alert would look like when it fires for real. It was not triggered by live data._\n\n${parsed.body || ""}`,
    level: "info",
    href: "/alerts",
  });

  return NextResponse.json({ ok: true });
}
