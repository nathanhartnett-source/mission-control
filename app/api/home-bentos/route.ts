import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/elements-auth";
import { listBentos, createBento } from "@/lib/home-bentos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ bentos: listBentos(auth.username) });
}

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => ({}));
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (prompt.length < 5) return NextResponse.json({ error: "prompt required" }, { status: 400 });
  const freq = Number(body?.frequencyHours);
  const title = typeof body?.title === "string" ? body.title.trim() : undefined;
  const bento = createBento(auth.username, prompt, Number.isFinite(freq) ? freq : 12, title);
  return NextResponse.json({ bento });
}
