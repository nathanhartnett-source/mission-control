import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/elements-auth";
import { getElement, saveElement, computeNextRunAt, type ElementSchedule } from "@/lib/elements";
import { getTimezone } from "@/lib/install-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await ctx.params;
  const spec = getElement(auth.username, slug);
  if (!spec) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (spec.createdBy !== auth.username) {
    return NextResponse.json({ error: "only the app creator can schedule it" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const freq = body?.freq;
  if (freq !== "daily" && freq !== "weekly" && freq !== "monthly") {
    return NextResponse.json({ error: "freq must be daily/weekly/monthly" }, { status: 400 });
  }
  // 24h HH:MM, hours 00-23 only, minutes 00-59. Old regex accepted 99:99.
  const time = typeof body?.time === "string" && /^([01]?\d|2[0-3]):[0-5]\d$/.test(body.time) ? body.time : "09:00";
  const sched: ElementSchedule = {
    freq,
    time,
    inputs: body?.inputs && typeof body.inputs === "object" ? body.inputs : {},
  };
  if (freq === "weekly") sched.dayOfWeek = Math.max(0, Math.min(6, Number(body?.dayOfWeek ?? 1)));
  if (freq === "monthly") sched.dayOfMonth = Math.max(1, Math.min(28, Number(body?.dayOfMonth ?? 1)));
  sched.nextRunAt = computeNextRunAt(sched, getTimezone());
  spec.schedule = sched;
  saveElement(auth.username, spec);
  return NextResponse.json({ ok: true, schedule: sched });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await ctx.params;
  const spec = getElement(auth.username, slug);
  if (!spec) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (spec.createdBy !== auth.username) {
    return NextResponse.json({ error: "only the app creator can clear its schedule" }, { status: 403 });
  }
  delete spec.schedule;
  saveElement(auth.username, spec);
  return NextResponse.json({ ok: true });
}
