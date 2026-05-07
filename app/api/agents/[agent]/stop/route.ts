import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { spawn } from "child_process";
import path from "path";
import os from "os";
import { INBOX_DIRS, OUTBOX_DIR, userInboxDir, type AgentName } from "../../../../../lib/agents";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Walk a process tree and SIGTERM every descendant. Uses pgrep -P recursively.
async function killTree(pid: number): Promise<void> {
  const children = await new Promise<number[]>((resolve) => {
    const ps = spawn("pgrep", ["-P", String(pid)]);
    let buf = "";
    ps.stdout.on("data", (d) => { buf += d.toString(); });
    ps.on("close", () => {
      resolve(buf.split("\n").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n)));
    });
    ps.on("error", () => resolve([]));
  });
  // Depth-first: kill descendants first
  for (const c of children) await killTree(c);
  try { process.kill(pid, "SIGTERM"); } catch { /* already dead */ }
}

async function pidsMatching(pattern: string): Promise<number[]> {
  return new Promise((resolve) => {
    const ps = spawn("pgrep", ["-f", pattern]);
    let buf = "";
    ps.stdout.on("data", (d) => { buf += d.toString(); });
    ps.on("close", () => {
      const own = process.pid;
      resolve(buf.split("\n")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 1 && n !== own));
    });
    ps.on("error", () => resolve([]));
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ agent: string }> }) {
  const { agent } = await ctx.params;
  const valid: AgentName[] = ["ava", "mia", "ash", "overseer", "me"];
  if (!valid.includes(agent as AgentName)) {
    return NextResponse.json({ error: "unknown agent" }, { status: 400 });
  }
  let body: { corr_id?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const corrId = (body.corr_id || "").trim();
  if (!corrId || !/^[A-Z0-9]{16,32}$/i.test(corrId)) {
    return NextResponse.json({ error: "valid corr_id required" }, { status: 400 });
  }

  // For per-user "me" agent, look up the session user so we can resolve the
  // correct per-user inbox dir.
  let username = "";
  if (agent === "me") {
    const cookie = req.cookies.get(SESSION_COOKIE)?.value;
    const session = verify(cookie);
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const user = findById(session.userId);
    if (!user || user.status !== "active") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    username = user.username;
  }

  const pidPath = path.join("/tmp", `mc-agent-${corrId}.pid`);
  const inboxDir = agent === "me" ? userInboxDir(username) : INBOX_DIRS[agent as AgentName];
  const inboxFile = path.join(inboxDir, `mc-agent-${agent}-${corrId}.json`);
  const runningFile = path.join(OUTBOX_DIR, `mc-agent-${corrId}-running.json`);
  const errorFile = path.join(OUTBOX_DIR, `mc-agent-${corrId}-error.json`);
  const doneFile = path.join(OUTBOX_DIR, `mc-agent-${corrId}-done.json`);

  // If it's already done, nothing to stop.
  try { await fs.access(doneFile); return NextResponse.json({ ok: true, status: "already-done" }); } catch { /* not done */ }

  // 1. Read PID file (if turn is actively running) and kill the tree.
  let killed = false;
  try {
    const raw = await fs.readFile(pidPath, "utf-8");
    const pid = parseInt(raw.trim(), 10);
    if (Number.isFinite(pid) && pid > 0) {
      await killTree(pid);
      killed = true;
    }
  } catch { /* no pid file — turn was queued, not yet running */ }

  // Older runner versions did not create pid files, so fall back to killing any
  // active runner command line that references this corr_id. This keeps Stop
  // from leaving a hidden heartbeat process that rewrites running.json forever.
  if (!killed) {
    const matches = await pidsMatching(`/home/nathan/bin/mc-ash-run-once .*${corrId}`);
    for (const pid of matches) {
      await killTree(pid);
      killed = true;
    }
  }

  // 2. Remove the inbox envelope so the next runner tick doesn't re-process it.
  try { await fs.unlink(inboxFile); } catch { /* already processed/deleted */ }

  // 3. Mark as error so the UI shows "stopped".
  const ts = new Date().toISOString();
  const errEnv = {
    schema: "mc-agent-response/v1",
    corr_id: corrId,
    agent,
    ts,
    state: "error",
    error: killed ? "Stopped by user (mid-turn)" : "Stopped by user (before runner picked up)",
  };
  await fs.mkdir(OUTBOX_DIR, { recursive: true });
  await fs.writeFile(errorFile, JSON.stringify(errEnv, null, 2), "utf-8");

  // 4. Cleanup running.json + pid file (kill should have removed pid; belt + braces).
  try { await fs.unlink(runningFile); } catch { /* not present */ }
  try { await fs.unlink(pidPath); } catch { /* not present */ }

  return NextResponse.json({ ok: true, killed, status: killed ? "killed" : "queue-cleared" });
}
