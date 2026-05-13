import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { SDK_VERSION, SDK_VERSION_LABEL } from "@/lib/sdk/version";
import { listIncompatibleCustomApps } from "@/lib/custom-apps";
import { readTamperFlag } from "@/lib/core-integrity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function isAdminSession(req: NextRequest): boolean {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return false;
  const user = findById(session.userId);
  return !!(user && user.status === "active" && user.isAdmin);
}

function sh(script: string, cwd: string, timeoutMs = 15000): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("bash", ["-c", script], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    const to = setTimeout(() => { try { child.kill("SIGKILL"); } catch {} }, timeoutMs);
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.stderr.on("data", (d) => { err += d.toString(); });
    child.on("close", (code) => { clearTimeout(to); resolve({ ok: code === 0, stdout: out.trim(), stderr: err.trim() }); });
    child.on("error", () => { clearTimeout(to); resolve({ ok: false, stdout: out, stderr: err }); });
  });
}

// GET /api/admin/api/deploy/status — current SHA + commits behind origin/main
export async function GET(req: NextRequest) {
  if (!isAdminSession(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const cwd = process.env.MC_HOME || process.cwd();

  // current HEAD
  const sha = (await sh("git rev-parse --short HEAD", cwd)).stdout || null;
  const subject = (await sh("git log -1 --pretty=%s", cwd)).stdout || null;
  const date = (await sh("git log -1 --pretty=%cI", cwd)).stdout || null;

  // refresh remote refs (non-fatal) then compare
  await sh("git fetch --quiet origin main", cwd, 20000);
  const behind = (await sh("git rev-list --count HEAD..origin/main", cwd)).stdout;
  const behindCount = Number.isFinite(parseInt(behind, 10)) ? parseInt(behind, 10) : 0;

  let behindCommits: { sha: string; subject: string }[] = [];
  if (behindCount > 0) {
    const r = await sh("git log --pretty=%h%x09%s HEAD..origin/main", cwd, 15000);
    behindCommits = r.stdout.split("\n").filter(Boolean).map((line) => {
      const [s, ...rest] = line.split("\t");
      return { sha: s, subject: rest.join("\t") };
    }).slice(0, 20);
  }

  const incompat = listIncompatibleCustomApps().map((a) => ({
    name: a.manifest.name,
    slug: a.manifest.slug,
    minSdk: a.manifest.minSdk,
    reason: a.reason,
  }));

  const tamper = readTamperFlag();

  return NextResponse.json({
    ok: true,
    sha,
    subject,
    date,
    behindCount,
    behindCommits,
    sdkVersion: SDK_VERSION,
    sdkVersionLabel: SDK_VERSION_LABEL,
    incompatibleApps: incompat,
    tamper: tamper ? {
      mismatchCount: tamper.mismatches.length,
      missingCount: tamper.missing.length,
      sampleMismatches: tamper.mismatches.slice(0, 10),
      sampleMissing: tamper.missing.slice(0, 5),
      checkedAt: tamper.checkedAt,
    } : null,
  });
}
