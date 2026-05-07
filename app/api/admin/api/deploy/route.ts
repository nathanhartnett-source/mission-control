import { NextRequest, NextResponse } from "next/server";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import { checkAdminApiAuth } from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const exec = promisify(execFile);

const LOCK_FILE = "/tmp/mc-deploy.lock";

export async function POST(req: NextRequest) {
  const fail = checkAdminApiAuth(req);
  if (fail) return fail;
  const repoDir = process.env.MC_REPO_DIR || "/root/mission-control";
  // Single-flight lock so concurrent deploys can't clobber each other's
  // .next/. Stale lock (>15min) is auto-released.
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const age = Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
      if (age < 15 * 60_000) {
        return NextResponse.json({ ok: false, step: "lock", error: `another deploy in progress (lock age ${Math.round(age / 1000)}s)` }, { status: 409 });
      }
      try { fs.unlinkSync(LOCK_FILE); } catch {}
    }
    fs.writeFileSync(LOCK_FILE, String(process.pid));
  } catch (e: any) {
    return NextResponse.json({ ok: false, step: "lock", error: e.message });
  }
  const releaseLock = () => { try { fs.unlinkSync(LOCK_FILE); } catch {} };
  const out: Record<string, any> = {};
  // Force-sync to origin/main. `git pull` fails on diverged histories (e.g.
  // after a force-push); reset --hard always works for a deploy box that
  // should never have local commits of its own.
  try {
    await exec("git", ["-C", repoDir, "fetch", "origin", "main"], { timeout: 60_000 });
    out.sync = (await exec("git", ["-C", repoDir, "reset", "--hard", "origin/main"], { timeout: 30_000 })).stdout;
  } catch (e: any) {
    releaseLock();
    return NextResponse.json({ ok: false, step: "sync", error: e.message, stderr: e.stderr });
  }
  // Force-include devDependencies (typescript etc.) even when the service
  // runs under NODE_ENV=production.
  try {
    out.install = (await exec("npm", ["--prefix", repoDir, "install", "--include=dev", "--no-audit", "--no-fund"], {
      timeout: 300_000,
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, NODE_ENV: "development" },
    })).stdout.slice(-2000);
  } catch (e: any) {
    releaseLock();
    return NextResponse.json({ ok: false, step: "install", error: e.message, stderr: (e.stderr || "").slice(-4000) });
  }
  try {
    out.build = (await exec("npm", ["--prefix", repoDir, "run", "build"], {
      timeout: 300_000,
      maxBuffer: 16 * 1024 * 1024,
    })).stdout.slice(-4000);
  } catch (e: any) {
    releaseLock();
    return NextResponse.json({ ok: false, step: "build", error: e.message, stderr: (e.stderr || "").slice(-4000) });
  }
  // Validate the build is complete (BUILD_ID exists) before allowing a
  // restart. If the build was clobbered or interrupted mid-write, we'd
  // restart into a broken `next start` that crash-loops.
  if (!fs.existsSync(`${repoDir}/.next/BUILD_ID`)) {
    releaseLock();
    return NextResponse.json({ ok: false, step: "build", error: "build complete but .next/BUILD_ID missing — refusing to restart" });
  }
  // Refresh the runner + stream parser in /usr/local/bin/ so live-pillbox
  // updates from install/ land without needing a fresh mc-install.sh run.
  try {
    await exec("install", ["-m", "0755", `${repoDir}/install/mc-user-agent-runner.sh`, "/usr/local/bin/mc-user-agent-runner.sh"], { timeout: 10_000 });
    try {
      await exec("install", ["-m", "0755", `${repoDir}/install/mc-agent-stream-parser.py`, "/usr/local/bin/mc-agent-stream-parser.py"], { timeout: 10_000 });
    } catch { /* parser file optional on older trees */ }
    out.runner = "installed";
  } catch (e: any) {
    releaseLock();
    return NextResponse.json({ ok: false, step: "runner", error: e.message, stderr: e.stderr });
  }
  // Schedule the restart in a detached child so the response can be sent
  // before systemd kills this very process. Otherwise the client always
  // sees `restart: failed` even when the restart succeeded.
  try {
    const child = spawn("/bin/sh", ["-c", "sleep 1 && systemctl restart mission-control"], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    out.restart = "scheduled";
  } catch (e: any) {
    releaseLock();
    return NextResponse.json({ ok: false, step: "restart", error: e.message });
  }
  releaseLock();
  return NextResponse.json({ ok: true, ...out });
}
