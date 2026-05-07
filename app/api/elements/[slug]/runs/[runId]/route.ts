import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/elements-auth";
import { getRun, killRun } from "@/lib/elements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string; runId: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { runId } = await ctx.params;
  const run = getRun(auth.username, runId);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ run });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ slug: string; runId: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { runId } = await ctx.params;
  const ok = killRun(auth.username, runId);
  return NextResponse.json({ ok });
}
