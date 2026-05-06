import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { bump, type Counter } from "@/lib/achievements";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID: Counter[] = ["messages", "tasks_done", "streak_days", "wiki_edits", "agent_trains", "avatar_rolls"];

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verify(cookie);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const user = findById(session.userId);
  if (!user || user.status !== "active") return NextResponse.json({ ok: false }, { status: 401 });
  let body: { kind?: string; by?: number; set?: number } = {};
  try { body = await req.json(); } catch {}
  const kind = (body.kind || "") as Counter;
  if (!VALID.includes(kind)) return NextResponse.json({ ok: false, error: "invalid kind" }, { status: 400 });
  const newly = bump(user.username, kind, { by: body.by, set: body.set });
  return NextResponse.json({ ok: true, newly });
}
