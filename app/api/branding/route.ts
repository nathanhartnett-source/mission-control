import { NextResponse } from "next/server";
import { readBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public: any caller (incl. login page) can fetch current branding so they
// know whether to show a logo and which theme to apply.
export async function GET() {
  return NextResponse.json({ ok: true, branding: readBranding() });
}
