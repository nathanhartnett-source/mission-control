import { NextRequest, NextResponse } from "next/server";
import { verifyLogin, bootstrapAdminIfEmpty } from "@/lib/users";
import { sign, SESSION_COOKIE, SESSION_TTL_SEC } from "@/lib/auth-session";
import { audit } from "@/lib/auth-audit";
import { checkLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  await bootstrapAdminIfEmpty();

  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") || "";

  const body = await req.json().catch(() => ({}));
  const username = (body.username || "").toString();
  const password = (body.password || "").toString();

  // Rate limit per-username AND per-IP to slow down brute force without
  // letting an attacker lock out a real user with a flood of bad attempts
  // from someone else's IP.
  const userLimit = checkLimit(`login:user:${username.toLowerCase()}`, 5, 15 * 60 * 1000);
  const ipLimit = checkLimit(`login:ip:${ip}`, 20, 15 * 60 * 1000);
  if (!userLimit.ok || !ipLimit.ok) {
    audit("login_fail", { reason: "rate_limit", username, ip, ua });
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const user = await verifyLogin(username, password);
  if (!user) {
    audit("login_fail", { reason: "bad_credentials", username, ip, ua });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { value, maxAge } = sign(user.id);
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const secure = req.nextUrl.protocol === "https:" || forwardedProto === "https";

  audit("login_ok", { userId: user.id, username: user.username, ip, ua });

  const res = NextResponse.json({ ok: true, personaCompleted: !!user.personaCompleted });
  res.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure,
  });
  void SESSION_TTL_SEC;
  return res;
}
