import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/elements-auth";
import { listDataAlerts, createDataAlert, validateSchedule } from "@/lib/data-alerts";
import { ALERT_SOURCES } from "@/lib/alert-sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_OPS = new Set(["<", "<=", ">", ">="]);
const SOURCE_IDS = new Set(ALERT_SOURCES.map((s) => s.id));

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ alerts: listDataAlerts(auth.username) });
}

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => ({}));
  const kind = body.kind === "research" ? "research" : body.kind === "reminder" ? "reminder" : "data";

  if (kind === "reminder") {
    const reminderText = typeof body.reminderText === "string" ? body.reminderText.slice(0, 1000) : "";
    if (reminderText.length < 1) return NextResponse.json({ error: "reminderText required" }, { status: 400 });
    const schedule = validateSchedule(body.schedule);
    if (!schedule && !body.cronTime) return NextResponse.json({ error: "schedule required" }, { status: 400 });
    const alert = createDataAlert(auth.username, {
      kind: "reminder",
      reminderText,
      schedule: schedule || undefined,
      // legacy fallback (still supported by the evaluator)
      cronTime: !schedule && typeof body.cronTime === "string" && /^\d{2}:\d{2}$/.test(body.cronTime) ? body.cronTime : undefined,
      daysOfWeek: !schedule && Array.isArray(body.daysOfWeek)
        ? body.daysOfWeek.filter((d: unknown): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)
        : undefined,
      label: typeof body.label === "string" ? body.label.slice(0, 120) : undefined,
      summary: typeof body.summary === "string" ? body.summary.slice(0, 400) : undefined,
      active: body.active !== false,
      cooldownHours: 1,
    });
    return NextResponse.json({ ok: true, alert });
  }

  if (kind === "research") {
    const prompt = typeof body.prompt === "string" ? body.prompt.slice(0, 2000) : "";
    if (prompt.length < 10) return NextResponse.json({ error: "prompt required" }, { status: 400 });
    const frequencyHours = Number(body.frequencyHours);
    if (!Number.isFinite(frequencyHours)) return NextResponse.json({ error: "bad frequencyHours" }, { status: 400 });
    const alert = createDataAlert(auth.username, {
      kind: "research",
      prompt,
      frequencyHours: Math.max(1, Math.min(168, frequencyHours)),
      label: typeof body.label === "string" ? body.label.slice(0, 120) : undefined,
      summary: typeof body.summary === "string" ? body.summary.slice(0, 400) : undefined,
      active: body.active !== false,
      cooldownHours: Number.isFinite(body.cooldownHours) ? Math.max(1, Math.min(168, Number(body.cooldownHours))) : Math.max(1, Math.min(168, frequencyHours)),
    });
    return NextResponse.json({ ok: true, alert });
  }

  if (!body?.source || !SOURCE_IDS.has(body.source)) return NextResponse.json({ error: "bad source" }, { status: 400 });
  if (!VALID_OPS.has(body.op)) return NextResponse.json({ error: "bad op" }, { status: 400 });
  const threshold = Number(body.threshold);
  if (!Number.isFinite(threshold)) return NextResponse.json({ error: "bad threshold" }, { status: 400 });

  const dims: Record<string, string> = {};
  if (body.dims && typeof body.dims === "object") {
    for (const [k, v] of Object.entries(body.dims as Record<string, unknown>)) {
      if (typeof v === "string" && /^[a-z0-9_-]{1,40}$/i.test(v)) dims[k] = v;
    }
  }

  const alert = createDataAlert(auth.username, {
    kind: "data",
    source: body.source,
    dims,
    op: body.op,
    threshold,
    intent: typeof body.intent === "string" ? body.intent.slice(0, 2000) : undefined,
    summary: typeof body.summary === "string" ? body.summary.slice(0, 400) : undefined,
    label: typeof body.label === "string" ? body.label.slice(0, 120) : undefined,
    active: body.active !== false,
    cooldownHours: Number.isFinite(body.cooldownHours) ? Math.max(1, Math.min(168, Number(body.cooldownHours))) : 24,
    minConsecutiveSamples: Number.isFinite(body.minConsecutiveSamples) ? Math.max(1, Math.min(20, Number(body.minConsecutiveSamples))) : 1,
  });
  return NextResponse.json({ ok: true, alert });
}
