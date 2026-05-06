import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById, denyById } from "@/lib/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const me = findById(session.userId);
  if (!me || !me.isAdmin || me.status !== "active") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const { id } = await ctx.params;
  const u = denyById(id, me.username);
  if (!u) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
