import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { memoryDir } from "@/lib/workspace";
import { bump } from "@/lib/achievements";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StreakState = { lastVisitYmd: string; streakDays: number };

function todayBrisbaneYmd(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Brisbane",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(new Date());
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86_400_000);
}

function streakFile(username: string): string {
  return path.join(memoryDir(username.toLowerCase()), "streak.json");
}

function readStreak(username: string): StreakState {
  try {
    const raw = fs.readFileSync(streakFile(username), "utf8");
    const p = JSON.parse(raw) as StreakState;
    if (p && typeof p.lastVisitYmd === "string" && typeof p.streakDays === "number") return p;
  } catch {}
  return { lastVisitYmd: "", streakDays: 0 };
}

function writeStreak(username: string, s: StreakState): void {
  const file = streakFile(username);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(s, null, 2));
}

function authedUsername(req: NextRequest): string | null {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verify(cookie);
  if (!session) return null;
  const user = findById(session.userId);
  if (!user || user.status !== "active") return null;
  return user.username;
}

export async function GET(req: NextRequest) {
  const username = authedUsername(req);
  if (!username) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, streak: readStreak(username) });
}

export async function POST(req: NextRequest) {
  const username = authedUsername(req);
  if (!username) return NextResponse.json({ ok: false }, { status: 401 });
  const today = todayBrisbaneYmd();
  const prev = readStreak(username);
  let next: StreakState;
  if (!prev.lastVisitYmd) {
    next = { lastVisitYmd: today, streakDays: 1 };
  } else if (prev.lastVisitYmd === today) {
    next = prev;
  } else {
    const gap = daysBetween(prev.lastVisitYmd, today);
    next = { lastVisitYmd: today, streakDays: gap === 1 ? prev.streakDays + 1 : 1 };
  }
  if (next !== prev) writeStreak(username, next);
  try { bump(username, "streak_days", { set: next.streakDays }); } catch {}
  return NextResponse.json({ ok: true, streak: next });
}
