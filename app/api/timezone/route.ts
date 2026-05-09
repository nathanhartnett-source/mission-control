import { NextResponse } from "next/server";
import { getTimezone } from "@/lib/install-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public read of the configured server timezone, used by client UIs that
// display "Times in <TZ>" hints (Schedule panel etc). No secrets here.
export async function GET() {
  return NextResponse.json({ timezone: getTimezone() });
}
