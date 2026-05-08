import { NextRequest, NextResponse } from "next/server";
import { listUsers, createPending, approveById, setUserRole } from "@/lib/users";
import { sign, SESSION_COOKIE } from "@/lib/auth-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Only firable when there is no existing active admin (first-run install).
function noAdminExists(): boolean {
  return listUsers().every((u) => !u.isAdmin || u.status !== "active");
}

export async function POST(req: NextRequest) {
  if (!noAdminExists()) {
    return NextResponse.json({ error: "setup-already-complete" }, { status: 403 });
  }

  let body: { username?: string; email?: string; password?: string } = {};
  try { body = await req.json(); } catch {}
  const username = (body.username || "").trim().toLowerCase();
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  if (!/^[a-z0-9_-]{2,32}$/.test(username)) return NextResponse.json({ error: "username must be 2-32 chars: a-z, 0-9, _, -" }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "valid email required" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });

  let userId: string;
  try {
    const { user } = await createPending({ username, email, password });
    userId = user.id;
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "USERNAME_TAKEN") return NextResponse.json({ error: "username already taken" }, { status: 409 });
    if (msg === "EMAIL_TAKEN") return NextResponse.json({ error: "email already in use" }, { status: 409 });
    return NextResponse.json({ error: msg || "failed to create admin" }, { status: 500 });
  }

  approveById(userId, "setup-wizard");
  setUserRole(userId, "admin");

  // Sign in immediately so the wizard's subsequent steps run as the new admin.
  const session = sign(userId);
  const res = NextResponse.json({ ok: true, user: { id: userId, username, email } });
  res.cookies.set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: session.maxAge,
  });
  return res;
}
