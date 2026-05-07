import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById, markPersonaCompleted } from "@/lib/users";
import { writePersona, type Persona } from "@/lib/workspace";
import { audit } from "@/lib/auth-audit";
import { clientIp } from "@/lib/rate-limit";
import { seedWelcomeMessage } from "@/lib/agents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TONES: Persona["tone"][] = ["concise", "warm", "dry-wit", "professional", "playful"];
const FORMS: Persona["formality"][] = ["casual", "balanced", "formal"];

function trimSentence(s: string, max = 140): string {
  const cleaned = s.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.length <= max) return cleaned;
  // soft-cut at the nearest space before max
  const cut = cleaned.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.!?-]+$/, "") + "…";
}

function buildWelcomeText(opts: {
  agentName: string;
  aboutMe: string;
  goals: string;
  emoji: boolean;
}): string {
  const about = trimSentence(opts.aboutMe.split(/[.\n]/)[0] || opts.aboutMe);
  const goal = trimSentence(opts.goals.split(/[.\n]/)[0] || opts.goals);
  const wave = opts.emoji ? " 👋" : "";
  const lines: string[] = [];
  lines.push(`Hi! I'm ${opts.agentName}.${wave} Lovely to meet you.`);
  lines.push("");
  if (about && goal) {
    lines.push(`I picked up that you're "${about}" and you'd like help with "${goal}".`);
  } else if (goal) {
    lines.push(`I picked up that you'd like help with "${goal}".`);
  } else if (about) {
    lines.push(`I picked up that you're "${about}".`);
  }
  if (lines.length > 1) lines.push("");
  lines.push("Where would you like to start?");
  return lines.join("\n");
}

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
    try {
      await seedWelcomeMessage({
        user: user.username,
        agentText: buildWelcomeText({ agentName, aboutMe, goals, emoji }),
      });
    } catch (e) {
      console.error("[onboarding/save] welcome-message seed failed", e);
    }
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
