import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/elements-auth";
import { getNavPrefs, setNavPrefs, type NavPrefs } from "@/lib/nav-prefs";
import { BUILTIN_APPS } from "@/lib/builtin-apps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ prefs: getNavPrefs(auth.username) });
}

export async function PUT(req: NextRequest) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  let body: Partial<NavPrefs> = {};
  try { body = await req.json(); } catch {}

  const validSlugs = new Set(BUILTIN_APPS.map((a) => a.slug));
  const pinnedBuiltins = Array.isArray(body.pinnedBuiltins)
    ? body.pinnedBuiltins.filter((s): s is string => typeof s === "string" && validSlugs.has(s))
    : [];
  const hiddenSystem = Array.isArray(body.hiddenSystem)
    ? body.hiddenSystem.filter((s): s is string => typeof s === "string" && validSlugs.has(s))
    : [];

  const prefs: NavPrefs = { pinnedBuiltins, hiddenSystem };
  await setNavPrefs(auth.username, prefs);
  return NextResponse.json({ prefs });
}
