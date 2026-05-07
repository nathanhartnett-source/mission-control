import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/elements-auth";
import { getElement, listPinned } from "@/lib/elements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/elements/pinned — returns the (slug, name, icon) of each app the
 * caller has pinned, in pin-order. Used by Nav.tsx to render pinned apps as
 * additional sidebar/mobile entries alongside the static menu.
 */
export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const slugs = listPinned(auth.username);
  const out: { slug: string; name: string; icon: string }[] = [];
  for (const slug of slugs) {
    const spec = getElement(auth.username, slug);
    if (!spec) continue;  // pinned slug references a deleted element — skip
    out.push({ slug: spec.slug, name: spec.name, icon: spec.icon || "✨" });
  }
  return NextResponse.json({ pinned: out });
}
