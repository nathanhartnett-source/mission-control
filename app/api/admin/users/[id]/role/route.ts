import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById, setUserRole, listUsers } from "@/lib/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID = new Set(["admin", "staff", "client"]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const me = findById(session.userId);
  if (!me || !me.isAdmin || me.status !== "active") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const role = body?.role;
  if (!VALID.has(role)) {
    return NextResponse.json({ ok: false, error: "invalid_role" }, { status: 400 });
  }
  if (id === me.id && role !== "admin") {
    const otherAdmins = listUsers().filter(u => u.isAdmin && u.status === "active" && u.id !== me.id);
    if (otherAdmins.length === 0) {
      return NextResponse.json({ ok: false, error: "last_admin" }, { status: 400 });
    }
  }
  const u = setUserRole(id, role);
  if (!u) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
