import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/elements-auth";
import { updateDataAlert, deleteDataAlert } from "@/lib/data-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.threshold === "number" && Number.isFinite(body.threshold)) patch.threshold = body.threshold;
  if (typeof body.label === "string") patch.label = body.label.slice(0, 120);
  if (typeof body.cooldownHours === "number") patch.cooldownHours = Math.max(1, Math.min(168, body.cooldownHours));
  if (typeof body.minConsecutiveSamples === "number") patch.minConsecutiveSamples = Math.max(1, Math.min(20, body.minConsecutiveSamples));
  if (typeof body.intent === "string") patch.intent = body.intent.slice(0, 2000);
  if (typeof body.summary === "string") patch.summary = body.summary.slice(0, 400);
  if (typeof body.prompt === "string") patch.prompt = body.prompt.slice(0, 2000);
  if (typeof body.frequencyHours === "number") patch.frequencyHours = Math.max(1, Math.min(168, body.frequencyHours));
  if (typeof body.source === "string") patch.source = body.source;
  if (typeof body.op === "string" && ["<", "<=", ">", ">="].includes(body.op)) patch.op = body.op;
  if (typeof body.threshold === "number" && Number.isFinite(body.threshold)) patch.threshold = body.threshold;
  if (body.dims && typeof body.dims === "object") {
    const d: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.dims as Record<string, unknown>)) if (typeof v === "string") d[k] = v;
    patch.dims = d;
  }
  if (body.kind === "data" || body.kind === "research") patch.kind = body.kind;
  const updated = updateDataAlert(auth.username, id, patch);
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, alert: updated });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  return NextResponse.json({ ok: deleteDataAlert(auth.username, id) });
}
