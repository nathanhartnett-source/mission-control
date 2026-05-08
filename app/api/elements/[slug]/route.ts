import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/elements-auth";
import { getElement, deleteElement, renameElement, saveElement, type ElementSpec } from "@/lib/elements";

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

// PATCH — partial update: { name?: string } renames, { shareWithOrg?: boolean } toggles share.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await ctx.params;
  const spec = getElement(auth.username, slug);
  if (!spec) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (spec.createdBy !== auth.username) {
    return NextResponse.json({ error: "can only edit your own elements" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  let newName: string | undefined;
  if (typeof body?.name === "string" && body.name.trim()) {
    const candidate: string = body.name.trim();
    const ok = renameElement(auth.username, slug, candidate);
    if (!ok) return NextResponse.json({ error: "rename failed" }, { status: 500 });
    newName = candidate;
  }
  if (typeof body?.shareWithOrg === "boolean") {
    const fresh = getElement(auth.username, slug);
    if (fresh) {
      fresh.shareWithOrg = body.shareWithOrg;
      saveElement(auth.username, fresh);
    }
  }
  return NextResponse.json({ ok: true, name: newName?.slice(0, 60) });
}

// PUT — full spec replace. Preserves slug, createdAt, createdBy.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await ctx.params;
  const existing = getElement(auth.username, slug);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (existing.createdBy !== auth.username) {
    return NextResponse.json({ error: "can only edit your own elements" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const validFormats = ["markdown", "pdf", "xlsx", "pptx"] as const;
  const merged: ElementSpec = {
    ...existing,
    name: typeof body.name === "string" && body.name.trim() ? String(body.name).slice(0, 80) : existing.name,
    description: typeof body.description === "string" ? String(body.description).slice(0, 400) : existing.description,
    icon: typeof body.icon === "string" ? String(body.icon).slice(0, 8) : existing.icon,
    inputs: Array.isArray(body.inputs) ? body.inputs.slice(0, 12) : existing.inputs,
    promptTemplate: typeof body.promptTemplate === "string" ? String(body.promptTemplate).slice(0, 8000) : existing.promptTemplate,
    outputFormat: validFormats.includes(body.outputFormat) ? body.outputFormat : existing.outputFormat,
    timeoutMin: typeof body.timeoutMin === "number" ? Math.min(30, Math.max(1, body.timeoutMin)) : existing.timeoutMin,
    shareWithOrg: typeof body.shareWithOrg === "boolean" ? body.shareWithOrg : existing.shareWithOrg,
    letterhead: existing.letterhead, // letterhead managed via separate upload route
  };
  saveElement(auth.username, merged);
  return NextResponse.json({ ok: true, spec: merged });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await ctx.params;
  const spec = getElement(auth.username, slug);
  if (!spec) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (spec.createdBy !== auth.username) {
    return NextResponse.json({ error: "can only delete your own elements" }, { status: 403 });
  }
  deleteElement(auth.username, slug);
  return NextResponse.json({ ok: true });
}
