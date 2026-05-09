import { NextRequest, NextResponse } from "next/server";
import os from "os";
import { verifyAdminApiToken } from "@/lib/admin-api-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function GET(req: NextRequest) {
  if (!verifyAdminApiToken(bearer(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    host: os.hostname(),
    uptimeSec: Math.round(process.uptime()),
    nodeVersion: process.version,
    pid: process.pid,
    now: new Date().toISOString(),
  });
}
