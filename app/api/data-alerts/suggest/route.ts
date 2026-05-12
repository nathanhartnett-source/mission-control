import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "child_process";
import { requireUser } from "@/lib/elements-auth";
import { ALERT_SOURCES } from "@/lib/alert-sources";
import { BUILTIN_APPS } from "@/lib/builtin-apps";
import { listElements } from "@/lib/elements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/data-alerts/suggest
// Returns { suggestions: [{title, prompt, kind}] } — 3-5 ideas the user
// could turn into real alerts. Click in UI prefills the chat composer.
export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;

  // Gather light user context.
  const elements = listElements(auth.username).map((e) => ({ name: e.name, description: e.description || "" }));
  const apps = BUILTIN_APPS.map((a) => ({ name: a.name, description: a.description }));
  const sources = ALERT_SOURCES.map((s) => ({ id: s.id, label: s.label, description: s.description }));

  const ctx = `USER: ${auth.username}

DASHBOARD APPS THEY HAVE:
${apps.map((a) => `- ${a.name} — ${a.description}`).join("\n")}

THEIR CUSTOM APPS (user-built):
${elements.length ? elements.map((e) => `- ${e.name}${e.description ? " — " + e.description : ""}`).join("\n") : "(none yet)"}

REGISTERED DATA SOURCES (for threshold alerts):
${sources.length ? sources.map((s) => `- ${s.id}: ${s.label} — ${s.description}`).join("\n") : "(none — research alerts only)"}`;

  const systemPrompt = `You are an alert recommendation assistant. Given a user's dashboard context, suggest 3-5 concrete, high-value alerts they could set up.

Mix of kinds is good:
- DATA alerts (threshold on a registered data source)
- RESEARCH alerts (recurring Claude web-search for news/regulatory/competitor changes)

Each suggestion should be:
- Specific (e.g. "Alert me when the ATO publishes a new ruling that affects small-business compliance"), not vague ("monitor news")
- Phrased AS A USER REQUEST — first-person plain English, ready to paste into a chat with the alert builder
- Likely to be actually useful given the user's apps + custom apps + registered data sources. If they have no registered data sources, lean heavily into research alerts.

Respond with ONLY this JSON (no prose, no markdown fences):
{
  "suggestions": [
    { "title": "<short label, max 8 words>", "prompt": "<the user's first-person request, 1-2 sentences>", "kind": "data|research", "why": "<one short sentence on why this would be useful for this user>" }
  ]
}

${ctx}`;

  const CLAUDE_BIN = process.env.CLAUDE_BIN || "/home/nathan/.npm-global/bin/claude";
  const result = spawnSync(CLAUDE_BIN, ["-p", "--model", "claude-sonnet-4-6"], {
    input: systemPrompt,
    encoding: "utf8",
    timeout: 55000,
    maxBuffer: 1024 * 1024,
  });
  const raw = (result.stdout || "").trim();
  if (!raw) return NextResponse.json({ error: "AI didn't respond" }, { status: 500 });

  let parsed: { suggestions?: { title?: string; prompt?: string; kind?: string; why?: string }[] } | null = null;
  try { parsed = JSON.parse(raw); }
  catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) try { parsed = JSON.parse(m[0]); } catch {}
  }
  if (!parsed?.suggestions || !Array.isArray(parsed.suggestions)) {
    return NextResponse.json({ error: "couldn't parse suggestions" }, { status: 500 });
  }
  const sanitised = parsed.suggestions.slice(0, 6).map((s) => ({
    title: String(s.title || "").slice(0, 100),
    prompt: String(s.prompt || "").slice(0, 600),
    kind: (s.kind === "data" || s.kind === "research") ? s.kind : "research",
    why: String(s.why || "").slice(0, 200),
  })).filter((s) => s.title && s.prompt);

  return NextResponse.json({ suggestions: sanitised });
}
