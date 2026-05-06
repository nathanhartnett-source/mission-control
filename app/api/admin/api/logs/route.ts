import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { checkAdminApiAuth } from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const exec = promisify(execFile);

export async function GET(req: NextRequest) {
  const fail = checkAdminApiAuth(req);
  if (fail) return fail;
  const url = new URL(req.url);
  const unit = url.searchParams.get("unit") || "mission-control";
  const lines = Math.min(parseInt(url.searchParams.get("lines") || "200", 10) || 200, 5000);
  if (!/^[a-z0-9@._-]+$/i.test(unit)) {
    return NextResponse.json({ ok: false, error: "bad unit name" }, { status: 400 });
  }
  try {
    const { stdout } = await exec("journalctl", ["-u", unit, "-n", String(lines), "--no-pager"], {
      timeout: 15_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    return NextResponse.json({ ok: true, unit, lines, log: stdout });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, stderr: e.stderr || "" });
  }
}
