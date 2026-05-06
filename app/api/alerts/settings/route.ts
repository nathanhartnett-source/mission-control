import { NextRequest, NextResponse } from "next/server";
import { readSettings, writeSettings, EVENT_DEFS, AlertSettings } from "@/lib/alerts";

export async function GET() {
  return NextResponse.json({ ok: true, event_defs: EVENT_DEFS, settings: readSettings() });
}

export async function PUT(req: NextRequest) {
  let body: Partial<AlertSettings>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const current = readSettings();
  const next: AlertSettings = {
    toggles: body.toggles && typeof body.toggles === "object"
      ? Object.fromEntries(Object.entries(body.toggles).map(([k, v]) => [k, Boolean(v)]))
      : current.toggles,
    quiet_hours_start: typeof body.quiet_hours_start === "string" ? body.quiet_hours_start : current.quiet_hours_start,
    quiet_hours_end:   typeof body.quiet_hours_end   === "string" ? body.quiet_hours_end   : current.quiet_hours_end,
    quiet_hours_critical_bypass: typeof body.quiet_hours_critical_bypass === "boolean"
      ? body.quiet_hours_critical_bypass
      : (current.quiet_hours_critical_bypass ?? true),
  };
  writeSettings(next);
  return NextResponse.json({ ok: true, settings: next });
}
