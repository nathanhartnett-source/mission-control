import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { runUserClaude } from "@/lib/user-claude";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Take the user's about-me + goals + tone choice, and ask Haiku for up to
 * 2 short follow-up questions that would help the agent tailor itself
 * better. If Haiku decides nothing useful is needed, returns 0 questions.
 *
 * Returns: { ok: true, questions: string[] }  (length 0..2)
 */
export async function POST(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verify(cookie);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const user = findById(session.userId);
  if (!user || user.status !== "active") {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const aboutMe = String(body.aboutMe || "").slice(0, 4000);
  const goals = String(body.goals || "").slice(0, 4000);
  const agentName = String(body.agentName || "").slice(0, 30);
  const tone = String(body.tone || "");

  if (!aboutMe || !goals) {
    return NextResponse.json({ ok: true, questions: [] });
  }

  const prompt = `A new user is onboarding a personal AI agent. Their answers so far:

AGENT NAME: ${agentName || "(not chosen)"}
TONE: ${tone || "(not chosen)"}

ABOUT ME:
${aboutMe}

WHAT I WANT FROM THE AGENT:
${goals}

Decide: would 1 or 2 short follow-up questions meaningfully help this agent tailor itself to the user? Only ask follow-ups if their answers are genuinely thin or ambiguous in a way that would change how the agent should behave. If the answers are already clear enough, ask zero questions.

Reply with ONLY a JSON object, no prose:
{"questions": ["...", "..."]}

Rules:
- 0 to 2 questions max.
- Each question one sentence, under 25 words.
- Concrete, friendly, not generic.
- No meta-questions ("what else should I know?"). Ask about specifics that would change the agent's behavior.`;

  const result = runUserClaude({
    prompt,
    username: user.username || user.id,
    model: "opus",
    timeoutMs: 45000,
  });
  if (result.exitCode !== 0) {
    console.error("[onboarding/follow-up]", result.stderr.slice(0, 500));
    return NextResponse.json({ ok: true, questions: [] });
  }
  const m = result.stdout.match(/\{[\s\S]*\}/);
  if (!m) return NextResponse.json({ ok: true, questions: [] });
  try {
    const parsed = JSON.parse(m[0]);
    const qs = Array.isArray(parsed?.questions) ? parsed.questions : [];
    const cleaned = qs
      .map((q: unknown) => String(q || "").trim())
      .filter((q: string) => q.length > 0)
      .slice(0, 2);
    return NextResponse.json({ ok: true, questions: cleaned });
  } catch {
    return NextResponse.json({ ok: true, questions: [] });
  }
}
