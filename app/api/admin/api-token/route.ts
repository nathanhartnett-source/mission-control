import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { getAdminApiToken, rotateAdminApiToken } from "@/lib/admin-api-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-session-gated read + rotate of the remote-ops bearer token.
 * Surfaced in Settings → Admin API Token panel so operators can copy it
 * without SSH-ing into the host.
 */
function gateAdmin(req: NextRequest) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = findById(session.userId);
  if (!user || !user.isAdmin) return null;
  return user;
}

export async function GET(req: NextRequest) {
  if (!gateAdmin(req)) return NextResponse.json({ error: "admin only" }, { status: 403 });
  return NextResponse.json({ ok: true, token: getAdminApiToken() });
}

export async function POST(req: NextRequest) {
  if (!gateAdmin(req)) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body?.action !== "rotate") return NextResponse.json({ error: "expected { action: 'rotate' }" }, { status: 400 });
  return NextResponse.json({ ok: true, token: rotateAdminApiToken() });
}
