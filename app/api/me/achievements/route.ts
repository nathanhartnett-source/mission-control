import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { CATALOG, listAwarded, peek } from "@/lib/achievements";
import { badgeDataUri } from "@/lib/badge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authed(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verify(cookie);
  if (!session) return null;
  const user = findById(session.userId);
  if (!user || user.status !== "active") return null;
  return user;
}

export async function GET(req: NextRequest) {
  const user = authed(req);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const mode = req.nextUrl.searchParams.get("mode");
  if (mode === "peek") {
    const fresh = peek(user.username);
    return NextResponse.json({
      ok: true,
      newly: fresh.map((a) => ({ ...a, badge: badgeDataUri(a, 128) })),
    });
  }
  const { achievements, counters } = listAwarded(user.username);
  const awardedIds = new Set(achievements.map((a) => a.id));
  return NextResponse.json({
    ok: true,
    counters,
    awarded: achievements.map((a) => ({ ...a, badge: badgeDataUri(a, 96) })),
    locked: CATALOG.filter((a) => !awardedIds.has(a.id)).map((a) => ({
      id: a.id,
      counter: a.counter,
      threshold: a.threshold,
      title: a.title,
      blurb: a.blurb,
      tier: a.tier,
      progress: counters[a.counter] || 0,
    })),
  });
}
