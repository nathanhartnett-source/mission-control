import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { readFeatureFlags, writeFeatureFlags } from "@/lib/feature-flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function auth(req: NextRequest) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = findById(session.userId);
  return user && user.status === "active" ? user : null;
}

// GET — any active user can read the flags (UI needs them to render correctly).
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json({ flags: readFeatureFlags() });
}

// POST — admins only. Body: { flags: { buildAnApp?: boolean, ... } }
export async function POST(req: NextRequest) {
  const user = auth(req);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const patch = body && typeof body === "object" && body.flags && typeof body.flags === "object" ? body.flags : null;
  if (!patch) return NextResponse.json({ error: "missing flags" }, { status: 400 });
  const next = writeFeatureFlags(patch);
  return NextResponse.json({ ok: true, flags: next });
}
