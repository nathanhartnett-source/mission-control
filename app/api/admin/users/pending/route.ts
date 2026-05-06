import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById, listPending } from "@/lib/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const me = findById(session.userId);
  if (!me || !me.isAdmin || me.status !== "active") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const users = listPending().map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    createdAt: u.createdAt,
    ip: u.ip,
    ua: u.ua,
  }));
  return NextResponse.json({ ok: true, users });
}
