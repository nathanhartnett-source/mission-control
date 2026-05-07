import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/elements-auth";
import { getElement, listPinned, setPinned } from "@/lib/elements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await ctx.params;
  // The element must exist and be visible to this user (own or shared org).
  const spec = getElement(auth.username, slug);
  if (!spec) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const pinned = body?.pinned === undefined ? !listPinned(auth.username).includes(slug) : !!body.pinned;
  setPinned(auth.username, slug, pinned);
  return NextResponse.json({ ok: true, pinned });
}
