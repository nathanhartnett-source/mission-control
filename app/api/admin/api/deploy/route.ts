import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { checkAdminApiAuth } from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const exec = promisify(execFile);

export async function POST(req: NextRequest) {
  const fail = checkAdminApiAuth(req);
  if (fail) return fail;
  const repoDir = process.env.MC_REPO_DIR || "/root/mission-control";
  const out: Record<string, any> = {};
  try {
    out.pull = (await exec("git", ["-C", repoDir, "pull"], { timeout: 60_000 })).stdout;
  } catch (e: any) {
    return NextResponse.json({ ok: false, step: "pull", error: e.message, stderr: e.stderr });
  }
  try {
    out.build = (await exec("npm", ["--prefix", repoDir, "run", "build"], {
      timeout: 300_000,
      maxBuffer: 16 * 1024 * 1024,
    })).stdout.slice(-4000);
  } catch (e: any) {
    return NextResponse.json({ ok: false, step: "build", error: e.message, stderr: (e.stderr || "").slice(-4000) });
  }
  try {
    out.restart = (await exec("systemctl", ["restart", "mission-control"], { timeout: 30_000 })).stdout;
  } catch (e: any) {
    return NextResponse.json({ ok: false, step: "restart", error: e.message, stderr: e.stderr });
  }
  return NextResponse.json({ ok: true, ...out });
}
