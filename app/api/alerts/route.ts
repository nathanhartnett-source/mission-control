import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fanout, readHistory, EVENT_DEFS, AlertEvent, AlertSeverity } from "@/lib/alerts";

/* Shared secret — external scripts (cron wrappers, watchdogs) present this in
   `Authorization: Bearer <secret>`. Internal mc users (logged in, carrying the
   mc_auth cookie) bypass the Bearer check because they've already authed via
   middleware semantics. The middleware doesn't cover this path (it's in
   PUBLIC_PATHS so external scripts can reach it), so we reimplement the cookie
   HMAC check here. */
function loadSharedSecret(): string | null {
  const fp = process.env.MC_ALERTS_SECRET_PATH ||
    path.join(process.env.HOME || "/home/nathan", ".openclaw/workspace/keys/mc-alerts-secret.txt");
  try { return fs.readFileSync(fp, "utf-8").trim() || null; } catch { return null; }
}

function hasValidMcCookie(req: NextRequest): boolean {
  const secret = process.env.MC_COOKIE_SECRET;
  const cookieVal = req.cookies.get("mc_auth")?.value;
  if (!secret || !cookieVal) return false;
  const expected = crypto.createHmac("sha256", secret).update("mc:authenticated").digest("hex");
  return cookieVal === expected;
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: NextRequest) {
  /* Auth — accept EITHER a valid mc_auth cookie (UI user) OR Bearer secret (scripts). */
  if (!hasValidMcCookie(req)) {
    const want = loadSharedSecret();
    if (want) {
      const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      if (got !== want) return bad("unauthorized", 401);
    }
  }

  /* Payload */
  let body: Partial<AlertEvent>;
  try { body = await req.json(); } catch { return bad("invalid JSON body"); }

  const source = (body.source || "").toString().trim();
  const type = (body.type || "").toString().trim();
  const severity = (body.severity || "info") as AlertSeverity;
  const title = (body.title || type || source).toString().trim();

  if (!source) return bad("missing 'source'");
  if (!type)   return bad("missing 'type'");
  if (!["critical", "warn", "info", "success"].includes(severity)) return bad("invalid 'severity'");
  if (!title)  return bad("missing 'title'");

  const evt: AlertEvent = {
    source, type, severity, title,
    message: typeof body.message === "string" ? body.message : undefined,
    log_tail: typeof body.log_tail === "string" ? body.log_tail : undefined,
    context: (body.context && typeof body.context === "object") ? body.context as Record<string, unknown> : undefined,
  };

  const result = await fanout(evt);
  return NextResponse.json({ ok: true, ...result });
}

/* GET — recent history + event catalog, used by the settings panel. */
export async function GET(req: NextRequest) {
  const limit = Math.min(500, parseInt(req.nextUrl.searchParams.get("limit") || "50", 10) || 50);
  return NextResponse.json({
    ok: true,
    event_defs: EVENT_DEFS,
    history: readHistory(limit),
  });
}
