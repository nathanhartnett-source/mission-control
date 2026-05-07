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
import { spawn } from "child_process";

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

function resolveClaudeBin(): string | null {
  if (process.env.CLAUDE_BIN && fs.existsSync(process.env.CLAUDE_BIN)) return process.env.CLAUDE_BIN;
  const candidates = [
    path.join(os.homedir(), ".npm-global", "bin", "claude"),
    "/usr/local/bin/claude",
    "/root/.npm-global/bin/claude",
  ];
  for (const c of candidates) {
    try { fs.accessSync(c, fs.constants.X_OK); return c; } catch { /* keep looking */ }
  }
  return null;
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
  const claudeBin = resolveClaudeBin();
  if (!claudeBin) return null;

  const fu = opts.followUps
    .filter((f) => f.question && f.answer)
    .map((f) => `- Q: ${f.question}\n  A: ${f.answer}`)
    .join("\n");

  const prompt = `You are "${opts.agentName}", the user's personal AI assistant in Mission Control. They just finished the onboarding wizard and are about to land on the chat screen — your message should already be waiting for them.

What they told you about themselves:
${opts.aboutMe}

What they want from you:
${opts.goals}
${fu ? `\nTheir follow-up answers:\n${fu}\n` : ""}
Voice rules:
- Tone: ${opts.tone}
- Formality: ${opts.formality}
- Emoji: ${opts.emoji ? "use sparingly" : "do not use emoji"}

Write your opening message. It MUST:
- Sound like a curious, warm friend — not a corporate chatbot
- Greet them and use your name "${opts.agentName}" once
- Pick out something SPECIFIC they mentioned (a person by name, a hobby, a role, a goal) and ask a genuine curious follow-up question about it
- Reflect their goal back in your own words — do NOT copy/quote what they wrote
- End with a clear "what's the number-one thing I can help you with first?" type prompt
- 2-4 short paragraphs, plain prose, no bullets or headings

Output ONLY the message text. No preamble, no markdown fences, no surrounding quotes.`;

  return new Promise<string | null>((resolve) => {
    const proc = spawn(
      claudeBin,
      ["-p", "--model", "claude-opus-4-7"],
      { env: { ...process.env, IS_SANDBOX: "1" } },
    );
    let stdout = "";
    let settled = false;
    const finish = (val: string | null) => { if (!settled) { settled = true; resolve(val); } };
    proc.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr?.on("data", () => { /* swallow */ });
    proc.stdin?.write(prompt);
    proc.stdin?.end();
    const timer = setTimeout(() => { try { proc.kill("SIGKILL"); } catch { /* gone */ } finish(null); }, 45_000);
    proc.on("error", () => { clearTimeout(timer); finish(null); });
    proc.on("exit", (code: number | null) => {
      clearTimeout(timer);
      const text = stdout.trim();
      if (code === 0 && text.length >= 30) finish(text);
      else finish(null);
    });
  });
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
