import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";

export function requireUser(req: NextRequest): { username: string } | NextResponse {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verify(cookie);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const u = findById(session.userId);
  if (!u || u.status !== "active") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return { username: u.username.toLowerCase() };
}
