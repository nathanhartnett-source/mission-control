// Onboarding interview turn endpoint.
//
// Body: { messages: InterviewMessage[] }
// Returns one of:
//   { type: "question", text, currentPillar, pillarsComplete }
//   { type: "done", plan: CompiledPlan }
//
// First call: pass an empty messages array → assistant returns the welcome
// + first identity question. Subsequent calls: append the user's reply and
// re-POST.

import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { runUserClaude } from "@/lib/user-claude";
import {
  buildInterviewMessages,
  type InterviewMessage,
  type CompiledPlan,
} from "@/lib/onboarding-interview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const user = findById(session.userId);
  if (!user || user.status !== "active") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const incoming: InterviewMessage[] = Array.isArray(body.messages) ? body.messages : [];
  // Sanitise transcript: clamp length + drop malformed entries.
  const messages: InterviewMessage[] = incoming
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
    .map((m) => ({ role: m.role, text: m.text.slice(0, 4000) }))
    .slice(0, 60);

  const prompt = buildInterviewMessages(messages);
  const result = runUserClaude({
    prompt,
    username: user.username,
    model: "opus",
    timeoutMs: 75000,
  });

  if (result.exitCode !== 0) {
    console.error("[onboarding/turn] claude exit", result.exitCode, result.stderr.slice(0, 400));
    return NextResponse.json({ error: "interview failed; try again" }, { status: 502 });
  }

  // Extract the first JSON object from stdout (Opus sometimes adds whitespace).
  const m = result.stdout.match(/\{[\s\S]*\}/);
  if (!m) {
    return NextResponse.json({ error: "no JSON in reply", raw: result.stdout.slice(0, 300) }, { status: 502 });
  }
  let parsed: { type?: string; text?: string; currentPillar?: string; pillarsComplete?: string[]; plan?: CompiledPlan };
  try {
    parsed = JSON.parse(m[0]);
  } catch {
    return NextResponse.json({ error: "invalid JSON in reply", raw: m[0].slice(0, 300) }, { status: 502 });
  }

  if (parsed.type === "done" && parsed.plan) {
    return NextResponse.json({ type: "done", plan: parsed.plan });
  }
  if (parsed.type === "question" && parsed.text) {
    return NextResponse.json({
      type: "question",
      text: parsed.text,
      currentPillar: parsed.currentPillar || "identity",
      pillarsComplete: Array.isArray(parsed.pillarsComplete) ? parsed.pillarsComplete : [],
    });
  }
  return NextResponse.json({ error: "unexpected reply shape", raw: m[0].slice(0, 300) }, { status: 502 });
}
