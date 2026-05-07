import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById, markPersonaCompleted } from "@/lib/users";
import { writePersona, type Persona } from "@/lib/workspace";
import { audit } from "@/lib/auth-audit";
import { clientIp } from "@/lib/rate-limit";
import { seedWelcomeMessage } from "@/lib/agents";
import fs from "fs";
import os from "os";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TONES: Persona["tone"][] = ["concise", "warm", "dry-wit", "professional", "playful"];
const FORMS: Persona["formality"][] = ["casual", "balanced", "formal"];

function buildWelcomeText(opts: {
  agentName: string;
  aboutMe: string;
  goals: string;
  emoji: boolean;
}): string {
  const wave = opts.emoji ? " 👋" : "";
  const lines: string[] = [];
  lines.push(`Hi! I'm ${opts.agentName}.${wave} Lovely to meet you.`);
  lines.push("");
  lines.push("What would you like to tackle first?");
  return lines.join("\n");
}

function resolveGeminiKey(): string | null {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const keyFile =
    process.env.MC_GEMINI_KEY_FILE ||
    path.join(os.homedir(), "legacy-workspace", "keys", "gemini.txt");
  try {
    const k = fs.readFileSync(keyFile, "utf-8").trim();
    return k || null;
  } catch {
    return null;
  }
}

async function generateWelcomeText(opts: {
  agentName: string;
  aboutMe: string;
  goals: string;
  tone: string;
  formality: string;
  emoji: boolean;
  followUps: { question: string; answer: string }[];
}): Promise<string | null> {
  const apiKey = resolveGeminiKey();
  if (!apiKey) return null;
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const fu = opts.followUps
      .filter((f) => f.question && f.answer)
      .map((f) => `- Q: ${f.question}\n  A: ${f.answer}`)
      .join("\n");
    const prompt = `You are an AI assistant introducing yourself for the first time to your new user. Your name is "${opts.agentName}". The user just finished an onboarding wizard and is about to land on the chat screen — they should see your message already waiting.

USER ABOUT-ME:
${opts.aboutMe}

USER GOALS:
${opts.goals}
${fu ? `\nFOLLOW-UP ANSWERS:\n${fu}\n` : ""}
PERSONALITY:
- Tone: ${opts.tone}
- Formality: ${opts.formality}
- Emoji: ${opts.emoji ? "use sparingly" : "do not use emoji"}

INSTRUCTIONS:
Write your opening message. It should:
- Greet them warmly and use their agent name "${opts.agentName}" once
- Show genuine interest in what they shared — pick out something specific (a person, hobby, role, goal) and ask a curious follow-up question about it
- Optionally ask "what's the number-one thing I can help you with first?" or similar to drive next action
- 2-4 short paragraphs, conversational, like a friend
- Do NOT just parrot back what they wrote in quotes
- Do NOT use bullet lists or headings
- Plain text only

Example shape (do NOT copy verbatim):
"Hi — I'm <name>. Loved hearing that you ... <specific reaction>. <Curious question about a specific detail>? Can't wait to help you ... <reflect their goal in your own words>. What's the number one thing I can do to help you get started?"

Output ONLY the message text — no preamble, no quotes around it.`;
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    const text = (res.text || "").trim();
    if (!text || text.length < 30) return null;
    return text;
  } catch (e) {
    console.error("[onboarding/save] gemini greeting failed", e);
    return null;
  }
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
      const llmText = await generateWelcomeText({
        agentName, aboutMe, goals, tone, formality, emoji, followUps,
      });
      const agentText = llmText || buildWelcomeText({ agentName, aboutMe, goals, emoji });
      await seedWelcomeMessage({ user: user.username, agentText });
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
