import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/elements-auth";
import { updateBento, deleteBento } from "@/lib/home-bentos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.prompt === "string") patch.prompt = body.prompt.slice(0, 1000);
  if (typeof body.title === "string") patch.title = body.title.slice(0, 60);
  if (typeof body.frequencyHours === "number") patch.frequencyHours = Math.max(1, Math.min(168, body.frequencyHours));
  const updated = updateBento(auth.username, id, patch);
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ bento: updated });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  return NextResponse.json({ ok: deleteBento(auth.username, id) });
}
