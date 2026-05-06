import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById, setAvatarSeed, setAgentAvatarSeed } from "@/lib/users";
import { bump } from "@/lib/achievements";

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
  let body: { seed?: string; agent?: string };
  try { body = await req.json(); } catch { body = {}; }
  const seed = (body.seed || "").trim();
  if (!seed || seed.length > 64 || !/^[A-Za-z0-9_:.-]+$/.test(seed)) {
    return NextResponse.json({ ok: false, error: "Invalid seed" }, { status: 400 });
  }
  const agent = (body.agent || "").trim().toLowerCase();
  if (agent) {
    if (!/^[a-z0-9_-]{1,32}$/.test(agent)) {
      return NextResponse.json({ ok: false, error: "Invalid agent" }, { status: 400 });
    }
    setAgentAvatarSeed(user.id, agent, seed);
    try { bump(user.username, "avatar_rolls"); bump(user.username, "agent_trains"); } catch {}
    return NextResponse.json({ ok: true, agent, avatarSeed: seed });
  }
  setAvatarSeed(user.id, seed);
  try { bump(user.username, "avatar_rolls"); } catch {}
  return NextResponse.json({ ok: true, avatarSeed: seed });
}
