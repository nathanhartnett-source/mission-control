import { NextRequest, NextResponse } from "next/server";
import { readMessages } from "../../../../lib/agents";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verify(cookie);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const user = findById(session.userId);
  if (!user || user.status !== "active") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const since = req.nextUrl.searchParams.get("since") || undefined;
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = limitRaw ? Math.max(1, Math.min(500, parseInt(limitRaw, 10) || 200)) : 200;

  // Non-admins only see messages they sent themselves. Admin sees everything,
  // unless ?self=1 is passed (used by FloatingChat to scope to caller's own thread).
  const selfOnly = req.nextUrl.searchParams.get("self") === "1";
  const userFilter = user.isAdmin && !selfOnly ? undefined : user.username;

  try {
    const rows = await readMessages({ sinceIso: since, limit, user: userFilter });
    return NextResponse.json({ ok: true, rows, count: rows.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
