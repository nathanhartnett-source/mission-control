import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import os from "os";
import { enqueue, type AgentName } from "../../../../../lib/agents";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { bump } from "@/lib/achievements";

export const runtime = "nodejs";

const SAFETY_KEYWORDS = [
  "send", "deploy", "publish", "push", "merge",
  "delete", "drop", "--force", "force-push",
  "rm -rf", "git reset --hard",
];

export async function POST(req: NextRequest, ctx: { params: Promise<{ agent: string }> }) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verify(cookie);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const sessionUser = findById(session.userId);
  if (!sessionUser || sessionUser.status !== "active") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { agent } = await ctx.params;

  // "me" = caller's own per-user agent. Available to every authenticated user.
  if (agent !== "me" && !sessionUser.isAdmin) {
    return NextResponse.json({
      error: "You can only message your own agent.",
    }, { status: 403 });
  }

  const valid = ["ava", "mia", "ash", "overseer", "me"];
  if (!valid.includes(agent)) {
    if (agent === "switchboard") {
      return NextResponse.json({
        error: "switchboard is voice-only — use POST /api/agents/switchboard/stream-call",
      }, { status: 400 });
    }
    return NextResponse.json({ error: "unknown agent" }, { status: 400 });
  }
  type Attachment = { name: string; path: string; mime?: string; size?: number };
  let body: { text?: string; thread_id?: string; confirmed?: boolean; attachments?: Attachment[] } = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const text = (body.text || "").trim();
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  if (attachments.length > 5) {
    return NextResponse.json({ error: "too many attachments (>5)" }, { status: 400 });
  }
  for (const a of attachments) {
    if (!a?.path?.startsWith("/tmp/mc-staging/")) {
      return NextResponse.json({ error: "invalid attachment path" }, { status: 400 });
    }
    if ((a.size || 0) > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "attachment too large" }, { status: 400 });
    }
  }
  if (!text && attachments.length === 0) {
    return NextResponse.json({ error: "text or attachments required" }, { status: 400 });
  }
  if (text.length > 8000) {
    return NextResponse.json({ error: "text too long (>8000 chars)" }, { status: 400 });
  }

  // Server-side safety scan as a backstop — client should also check first
  const lower = text.toLowerCase();
  const matchedKeywords = SAFETY_KEYWORDS.filter((k) => lower.includes(k));
  if (matchedKeywords.length > 0 && !body.confirmed) {
    return NextResponse.json({
      requires_confirmation: true,
      matched_keywords: matchedKeywords,
      message: `Message contains sensitive keyword(s): ${matchedKeywords.join(", ")}. Resend with confirmed=true to proceed.`,
    }, { status: 409 });
  }

  try {
    // If attachments are present, append a readable note so the agent sees the file paths inline.
    let displayText = text;
    if (attachments.length > 0) {
      const lines = attachments.map((a) => `- ${a.name} (${a.mime || "file"}) → ${a.path}`);
      displayText = (displayText ? displayText + "\n\n" : "") + `[attachments]\n${lines.join("\n")}`;
    }
    const env = await enqueue(agent as AgentName, displayText, {
      thread_id: body.thread_id,
      attachments,
      user: sessionUser.username,
      user_id: sessionUser.id,
    });

    // Kick the agent's runner immediately so the user doesn't wait up to 60s
    // for the cron tick. Cron remains the fallback.
    if (agent === "me") {
      // Resolve runner location: env override → /usr/local/bin (install kit's
      // canonical destination) → ~/bin/ (Nathan's WSL dev box). First match wins.
      let runnerPath = process.env.MC_USER_AGENT_RUNNER || "";
      if (!runnerPath) {
        const candidates = [
          "/usr/local/bin/mc-user-agent-runner.sh",
          path.join(os.homedir(), "bin", "mc-user-agent-runner.sh"),
        ];
        for (const c of candidates) { try { if (require("fs").existsSync(c)) { runnerPath = c; break; } } catch {} }
      }
      if (!runnerPath) runnerPath = "/usr/local/bin/mc-user-agent-runner.sh"; // fall through, will surface ENOENT loudly
      const child = spawn(runnerPath, [sessionUser.username], {
        detached: true,
        stdio: "ignore",
        env: { ...process.env, HOME: os.homedir() },
      });
      child.unref();
    } else if (agent === "ash") {
      const envPath = path.join(os.homedir(), "wiki", "_inbox", `mc-agent-ash-${env.corr_id}.json`);
      const child = spawn("/home/nathan/bin/mc-ash-run-once", [envPath], {
        detached: true,
        stdio: "ignore",
        env: { ...process.env, HOME: os.homedir() },
      });
      child.unref();
    } else {
      // ava | mia | overseer — same idea, generic runner
      const inboxBase = agent === "mia"
        ? path.join(os.homedir(), ".claude", "channels", "discord-b", "inbox")
        : agent === "overseer"
        ? path.join(os.homedir(), ".claude", "channels", "discord-os", "inbox")
        : path.join(os.homedir(), ".claude", "channels", "discord", "inbox");
      const envPath = path.join(inboxBase, `mc-agent-${agent}-${env.corr_id}.json`);
      const child = spawn("/home/nathan/bin/mc-cc-run-once", [agent, envPath], {
        detached: true,
        stdio: "ignore",
        env: { ...process.env, HOME: os.homedir() },
      });
      child.unref();
    }

    let achievementsNewly: ReturnType<typeof bump> = [];
    try { achievementsNewly = bump(sessionUser.username, "messages"); } catch {}
    return NextResponse.json({ ok: true, corr_id: env.corr_id, ts: env.ts, achievements_newly: achievementsNewly.map((a) => a.id) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
