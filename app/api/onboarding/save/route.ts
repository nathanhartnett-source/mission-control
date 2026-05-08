import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById, markPersonaCompleted } from "@/lib/users";
import { writePersona, type Persona } from "@/lib/workspace";
import { audit } from "@/lib/auth-audit";
import { clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TONES: Persona["tone"][] = ["concise", "warm", "dry-wit", "professional", "playful"];
const FORMS: Persona["formality"][] = ["casual", "balanced", "formal"];

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verify(cookie);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const user = findById(session.userId);
  if (!user || user.status !== "active") {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const agentName = String(body.agentName || "").trim().slice(0, 30);
  const tone = TONES.includes(body.tone) ? body.tone : "concise";
  const emoji = !!body.emoji;
  const formality = FORMS.includes(body.formality) ? body.formality : "balanced";
  const aboutMe = String(body.aboutMe || "").slice(0, 4000);
  const goals = String(body.goals || "").slice(0, 4000);
  const followUps = Array.isArray(body.followUps)
    ? body.followUps.slice(0, 3).map((f: { question?: string; answer?: string }) => ({
        question: String(f?.question || "").slice(0, 500),
        answer: String(f?.answer || "").slice(0, 2000),
      }))
    : [];

  if (!agentName || !/^[A-Za-z][A-Za-z0-9 _-]{0,29}$/.test(agentName)) {
    return NextResponse.json({ ok: false, error: "Invalid agent name." }, { status: 400 });
  }
  if (!aboutMe || !goals) {
    return NextResponse.json({ ok: false, error: "Please fill in about-you and goals." }, { status: 400 });
  }

  const persona: Persona = { agentName, tone, emoji, formality, aboutMe, goals, followUps };

  try {
    writePersona(user.username, persona);
    markPersonaCompleted(user.id);
    try { (await import("@/lib/achievements")).bump(user.username, "agent_trains"); } catch {}
    audit("onboarding_complete", {
      userId: user.id,
      username: user.username,
      ip: clientIp(req),
      ua: req.headers.get("user-agent") || "",
      agentName,
      tone,
      emoji,
      formality,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[onboarding/save]", e);
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 });
  }
}
