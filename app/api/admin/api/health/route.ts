import { NextRequest, NextResponse } from "next/server";
import { checkAdminApiAuth } from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const fail = checkAdminApiAuth(req);
  if (fail) return fail;
  return NextResponse.json({
    ok: true,
    hostname: process.env.HOSTNAME || null,
    node: process.version,
    pid: process.pid,
    uptime: process.uptime(),
    cwd: process.cwd(),
    env_present: {
      MC_ADMIN_API_TOKEN: !!process.env.MC_ADMIN_API_TOKEN,
      MC_COOKIE_SECRET: !!process.env.MC_COOKIE_SECRET,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      MC_REPO_DIR: process.env.MC_REPO_DIR || "(default /root/mission-control)",
    },
  });
}
