import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const exec = promisify(execFile);

export async function GET(req: NextRequest) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const me = findById(session.userId);
  if (!me || !me.isAdmin || me.status !== "active") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const repoDir = process.env.MC_REPO_DIR || "/root/mission-control";
  try {
    await exec("git", ["-C", repoDir, "fetch", "--quiet"], { timeout: 30_000 });
    const head = (await exec("git", ["-C", repoDir, "rev-parse", "HEAD"], { timeout: 5_000 })).stdout.trim();
    const branch = (await exec("git", ["-C", repoDir, "rev-parse", "--abbrev-ref", "HEAD"], { timeout: 5_000 })).stdout.trim();
    const remote = (await exec("git", ["-C", repoDir, "rev-parse", `origin/${branch}`], { timeout: 5_000 })).stdout.trim();
    const log = (await exec("git", ["-C", repoDir, "log", "--oneline", `HEAD..origin/${branch}`], { timeout: 10_000 })).stdout;
    const commits = log.split("\n").filter(Boolean);
    return NextResponse.json({
      ok: true,
      head: head.slice(0, 7),
      remote: remote.slice(0, 7),
      branch,
      behind: commits.length,
      commits,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "check failed" }, { status: 500 });
  }
}
