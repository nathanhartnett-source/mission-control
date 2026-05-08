import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { readBranding, writeBranding, THEME_KEYS, type ThemeColors } from "@/lib/branding";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, branding: readBranding() });
}

export async function PUT(req: NextRequest) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const user = findById(session.userId);
  if (!user || !user.isAdmin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const patch: Parameters<typeof writeBranding>[0] = {};

  // Brand name (string | null | omit)
  if ("brandName" in body) {
    if (body.brandName === null || body.brandName === "") {
      patch.brandName = null;
    } else if (typeof body.brandName === "string") {
      patch.brandName = body.brandName.trim().slice(0, 64);
    }
  }

  // Theme (validated hex map | null clears | omit leaves alone)
  if ("theme" in body) {
    if (body.theme === null) {
      patch.theme = {};
    } else if (body.theme && typeof body.theme === "object") {
      const incoming = body.theme as Record<string, unknown>;
      const theme: ThemeColors = {};
      for (const k of THEME_KEYS) {
        const v = incoming[k];
        if (typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v)) {
          (theme as Record<string, string>)[k] = v;
        }
      }
      patch.theme = theme;
    }
  }

  const next = writeBranding(patch);
  return NextResponse.json({ ok: true, branding: next });
}
