import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { resolveBranding, readOverride, writeOverride } from "@/lib/branding-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, branding: resolveBranding() });
}

export async function POST(req: NextRequest) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const user = findById(session.userId);
  if (!user || !user.isAdmin || user.status !== "active") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  let body: { name?: string; logoSvg?: string; logoDataUrl?: string; clearLogo?: boolean };
  try { body = await req.json(); } catch { body = {}; }

  const current = readOverride();
  const next = { ...current };

  if (typeof body.name === "string") {
    const n = body.name.trim();
    if (n.length > 64) return NextResponse.json({ ok: false, error: "Name too long" }, { status: 400 });
    if (n) next.name = n; else delete next.name;
  }
  if (body.clearLogo) {
    delete next.logoSvg;
    delete next.logoDataUrl;
  }
  if (typeof body.logoSvg === "string") {
    const s = body.logoSvg.trim();
    if (s.length > 200_000) return NextResponse.json({ ok: false, error: "SVG too large" }, { status: 400 });
    if (!/^<svg[\s>]/i.test(s)) return NextResponse.json({ ok: false, error: "Not an SVG" }, { status: 400 });
    next.logoSvg = s;
    delete next.logoDataUrl;
  }
  if (typeof body.logoDataUrl === "string") {
    const d = body.logoDataUrl.trim();
    if (d.length > 800_000) return NextResponse.json({ ok: false, error: "Logo too large (max ~600KB)" }, { status: 400 });
    if (!/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/.test(d)) {
      return NextResponse.json({ ok: false, error: "Bad data URL" }, { status: 400 });
    }
    next.logoDataUrl = d;
    delete next.logoSvg;
  }

  writeOverride(next);
  return NextResponse.json({ ok: true, branding: resolveBranding() });
}
