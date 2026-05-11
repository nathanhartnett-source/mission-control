import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/elements-auth";
import { getElement, deleteElement, purgeElement, renameElement } from "@/lib/elements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await ctx.params;
  const spec = getElement(auth.username, slug);
  if (!spec) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ spec });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await ctx.params;
  const spec = getElement(auth.username, slug);
  if (!spec) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (spec.createdBy !== auth.username) {
    return NextResponse.json({ error: "can only rename your own elements" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const newName = (body?.name || "").toString().trim();
  if (!newName) return NextResponse.json({ error: "name required" }, { status: 400 });
  const ok = renameElement(auth.username, slug, newName);
  if (!ok) return NextResponse.json({ error: "rename failed" }, { status: 500 });
  return NextResponse.json({ ok: true, name: newName.slice(0, 60) });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await ctx.params;
  const permanent = new URL(req.url).searchParams.get("permanent") === "1";
  if (permanent) {
    // Purge from bin — caller must already have soft-deleted.
    const ok = purgeElement(auth.username, slug);
    return NextResponse.json({ ok, bin: false });
  }
  const spec = getElement(auth.username, slug);
  if (!spec) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (spec.createdBy !== auth.username) {
    return NextResponse.json({ error: "can only delete your own elements" }, { status: 403 });
  }
  deleteElement(auth.username, slug);
  return NextResponse.json({ ok: true, bin: true });
}
