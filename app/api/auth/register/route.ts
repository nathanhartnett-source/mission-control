import { NextRequest, NextResponse } from "next/server";
import { createPending, validateRegistration, findAdminEmails, bootstrapAdminIfEmpty } from "@/lib/users";
import { sendApprovalEmail } from "@/lib/mailer";
import { checkLimit, clientIp } from "@/lib/rate-limit";
import { audit } from "@/lib/auth-audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GENERIC_OK = { ok: true, message: "If your details are valid, your request has been submitted." };

export async function POST(req: NextRequest) {
  await bootstrapAdminIfEmpty();

  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") || "";
  const ipLimit = checkLimit(`reg:ip:${ip}`, 3, 60 * 60 * 1000);
  if (!ipLimit.ok) {
    audit("register_blocked", { reason: "rate_limit", ip, ua, retryAfter: ipLimit.retryAfterSec });
    return NextResponse.json(
      { ok: false, error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSec) } },
    );
  }

  let body: { username?: string; email?: string; password?: string; confirmPassword?: string; avatarSeed?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const validationError = validateRegistration({
    username: body.username || "",
    email: body.email || "",
    password: body.password || "",
    confirmPassword: body.confirmPassword || "",
  });
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  }

  try {
    const { user, rawToken } = await createPending({
      username: body.username!,
      email: body.email!,
      password: body.password!,
      avatarSeed: typeof body.avatarSeed === "string" && body.avatarSeed.length <= 64 ? body.avatarSeed : undefined,
      ip,
      ua,
    });

    const origin = originForApprovalLinks(req);
    const approveUrl = `${origin}/api/auth/approve?token=${encodeURIComponent(rawToken)}`;
    const denyUrl = `${origin}/api/auth/deny?token=${encodeURIComponent(rawToken)}`;

    const adminEmails = findAdminEmails();
    if (adminEmails.length === 0) {
      // Fallback to known bootstrap admin email so the request isn't black-holed.
      adminEmails.push(process.env.MC_ADMIN_EMAIL || "nathanhartnett@allhart.com.au");
    }

    // Fire emails in parallel; catch per-recipient errors so one bad address
    // doesn't kill the whole request.
    await Promise.allSettled(
      adminEmails.map(to =>
        sendApprovalEmail({
          to,
          username: user.username,
          email: user.email,
          ip,
          ua,
          approveUrl,
          denyUrl,
        }),
      ),
    );

    audit("register", { username: user.username, email: user.email, ip, ua });
    return NextResponse.json(GENERIC_OK);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "USERNAME_TAKEN" || msg === "EMAIL_TAKEN") {
      audit("register_blocked", { reason: msg.toLowerCase(), ip, ua, username: body.username });
      // Generic response to avoid leaking which one collided.
      return NextResponse.json(GENERIC_OK);
    }
    audit("register_blocked", { reason: "internal_error", ip, ua, error: msg });
    return NextResponse.json({ ok: false, error: "Server error. Try again later." }, { status: 500 });
  }
}

function originForApprovalLinks(req: NextRequest): string {
  // Prefer explicit env (always correct in prod), fall back to request host.
  if (process.env.MC_PUBLIC_ORIGIN) return process.env.MC_PUBLIC_ORIGIN.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "") || "https";
  const host = req.headers.get("host") || req.nextUrl.host;
  return `${proto}://${host}`;
}
