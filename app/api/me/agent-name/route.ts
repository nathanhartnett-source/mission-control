import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById, setAgentName } from "@/lib/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verify(cookie);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const user = findById(session.userId);
  if (!user || user.status !== "active") {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let body: { agent?: string; name?: string };
  try { body = await req.json(); } catch { body = {}; }
  const agent = (body.agent || "me").trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,32}$/.test(agent)) {
    return NextResponse.json({ ok: false, error: "Invalid agent" }, { status: 400 });
  }
  const name = (body.name || "").trim();
  if (name.length > 64) {
    return NextResponse.json({ ok: false, error: "Name too long" }, { status: 400 });
  }
  if (name && !/^[\p{L}\p{N} _'.\-]+$/u.test(name)) {
    return NextResponse.json({ ok: false, error: "Invalid name" }, { status: 400 });
  }
  setAgentName(user.id, agent, name);
  return NextResponse.json({ ok: true, agent, name });
}
