import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/elements-auth";
import { getNavPrefs, setNavPrefs, type NavPrefs, type NavFolder } from "@/lib/nav-prefs";
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
  let body: Partial<NavPrefs> & { pinnedBuiltins?: string[] } = {};
  try { body = await req.json(); } catch {}

  const builtinSlugs = new Set(BUILTIN_APPS.map((a) => a.slug));
  // Slugs in pinnedOrder/folders may be either built-in app slugs or custom
  // Element slugs. Allow any safe identifier; Nav.tsx resolves at render time.
  const SAFE = /^[a-z0-9_-]{1,60}$/i;
  const isSafeSlug = (s: unknown): s is string => typeof s === "string" && SAFE.test(s);

  const pinIn = Array.isArray(body.pinnedOrder)
    ? body.pinnedOrder
    : Array.isArray(body.pinnedBuiltins) ? body.pinnedBuiltins : [];
  const pinnedOrder = pinIn.filter(isSafeSlug);

  // hiddenSystem only applies to built-in "system"-kind apps.
  const hiddenSystem = Array.isArray(body.hiddenSystem)
    ? body.hiddenSystem.filter((s): s is string => typeof s === "string" && builtinSlugs.has(s))
    : [];

  const folders: NavFolder[] = Array.isArray(body.folders)
    ? body.folders
      .map((f) => {
        if (!f || typeof f !== "object") return null;
        const x = f as { id?: unknown; name?: unknown; slugs?: unknown };
        if (typeof x.id !== "string" || typeof x.name !== "string" || !Array.isArray(x.slugs)) return null;
        const slugs = x.slugs.filter(isSafeSlug);
        return { id: x.id.slice(0, 40), name: x.name.slice(0, 60) || "Folder", slugs };
      })
      .filter((f): f is NavFolder => f !== null)
    : [];

  // Dedupe: a slug in any folder is removed from pinnedOrder; a slug in two
  // folders ends up only in the first.
  const seen = new Set<string>();
  for (const f of folders) f.slugs = f.slugs.filter((s) => (seen.has(s) ? false : (seen.add(s), true)));
  const pinnedDedup = pinnedOrder.filter((s) => (seen.has(s) ? false : (seen.add(s), true)));

  const prefs: NavPrefs = { pinnedOrder: pinnedDedup, hiddenSystem, folders };
  await setNavPrefs(auth.username, prefs);
  return NextResponse.json({ prefs });
}
