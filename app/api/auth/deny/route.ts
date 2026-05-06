import { NextRequest, NextResponse } from "next/server";
import { denyByToken } from "@/lib/users";
import { audit } from "@/lib/auth-audit";
import { clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") || "";

  if (!token) {
    return redirectToResult(req, "missing");
  }

  const result = denyByToken(token, "email-link");
  if (!result.ok) {
    audit("token_invalid", { kind: "deny", reason: result.reason, ip, ua });
    return redirectToResult(req, result.reason);
  }

  audit("deny", { username: result.user.username, email: result.user.email, ip, ua });
  return redirectToResult(req, "denied", result.user.username);
}

function redirectToResult(req: NextRequest, status: string, username?: string) {
  const url = req.nextUrl.clone();
  url.pathname = "/auth/result";
  url.search = "";
  url.searchParams.set("kind", "deny");
  url.searchParams.set("status", status);
  if (username) url.searchParams.set("user", username);
  return NextResponse.redirect(url);
}
