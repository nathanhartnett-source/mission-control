import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const exec = promisify(execFile);

export async function POST(req: NextRequest) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const me = findById(session.userId);
  if (!me || !me.isAdmin || me.status !== "active") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const repoDir = process.env.MC_REPO_DIR || "/root/mission-control";
  const serviceName = process.env.MC_SERVICE_NAME || "mission-control";
  const out: Record<string, string> = {};

  try {
    out.pull = (await exec("git", ["-C", repoDir, "pull"], { timeout: 60_000 })).stdout;
  } catch (e: any) {
    return NextResponse.json({ ok: false, step: "pull", error: e.message, stderr: (e.stderr || "").slice(-2000) }, { status: 500 });
  }
  try {
    await exec("npm", ["--prefix", repoDir, "install", "--no-audit", "--no-fund"], {
      timeout: 240_000,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, step: "install", error: e.message, stderr: (e.stderr || "").slice(-2000) }, { status: 500 });
  }
  try {
    out.build = (await exec("npm", ["--prefix", repoDir, "run", "build"], {
      timeout: 360_000,
      maxBuffer: 32 * 1024 * 1024,
    })).stdout.slice(-2000);
  } catch (e: any) {
    return NextResponse.json({ ok: false, step: "build", error: e.message, stderr: (e.stderr || "").slice(-2000) }, { status: 500 });
  }
  // Fire-and-forget the restart so the response can flush before the service drops.
  setTimeout(() => {
    execFile("systemctl", ["restart", serviceName], () => {});
  }, 200);
  return NextResponse.json({ ok: true, restarting: true, ...out });
}
