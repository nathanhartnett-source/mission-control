import { NextRequest, NextResponse } from "next/server";

export function checkAdminApiAuth(req: NextRequest): NextResponse | null {
  const token = process.env.MC_ADMIN_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "admin api disabled (MC_ADMIN_API_TOKEN not set)" },
      { status: 503 }
    );
  }
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m || m[1] !== token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return null;
}
