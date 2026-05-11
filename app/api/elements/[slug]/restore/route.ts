import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/elements-auth";
import { restoreElement } from "@/lib/elements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await ctx.params;
  const result = restoreElement(auth.username, slug);
  if (!result.ok) return NextResponse.json({ error: result.reason || "restore failed" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
