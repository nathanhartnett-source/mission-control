import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { changePassword } from "@/lib/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { currentPassword, newPassword } = body || {};
  const result = await changePassword(session.userId, currentPassword || "", newPassword || "");
  if (!result.ok) {
    const status = result.reason === "wrong_password" ? 403 : 400;
    return NextResponse.json({ ok: false, error: result.reason }, { status });
  }
  return NextResponse.json({ ok: true });
}
