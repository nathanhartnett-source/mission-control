import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { markRead, deleteMessage } from "@/lib/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authedUser(req: NextRequest) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const u = findById(session.userId);
  if (!u || u.status !== "active") return null;
  return u;
}

// POST /api/inbox/<id>  — mark read (default) or unread via { read: false }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = authedUser(req);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const read = body?.read !== false;
  const updated = markRead(user.username, id, read);
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, message: updated });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = authedUser(req);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await ctx.params;
  const ok = deleteMessage(user.username, id);
  return NextResponse.json({ ok });
}
