/**
 * mc alerts bus — central event router.
 *
 * Scripts POST events to /api/alerts. This lib handles:
 *   - validating + normalising the incoming payload
 *   - appending to alerts.jsonl (history)
 *   - reading the per-event-type notification toggles
 *   - fanning out to Discord webhook if the toggle for that event is on
 *
 * Extending later: add push/email/sms sinks by pulling their URLs from the
 * webhook key file + adding their branch in fanout().
 */
import fs from "fs";
import path from "path";

export type AlertSeverity = "critical" | "warn" | "info" | "success";

export interface AlertEvent {
  source: string;              // e.g. "buffer-followup", "ash-x", "mu-plugins-watchdog"
  type: string;                // e.g. "cron.buffer-1130am.failure"
  severity: AlertSeverity;
  title: string;
  message?: string;
  log_tail?: string;
  context?: Record<string, unknown>;
  received_at?: string;        // filled in by the server
}

export interface EventDefinition {
  type: string;
  label: string;
  description: string;
  default_enabled: boolean;
  default_severity: AlertSeverity;
}

/* Known event types — edit this to add new toggleable events. The UI renders
   a toggle for each entry. New events from scripts that AREN'T listed here
   still fire (unknown types default to enabled) but won't show up in the UI
   until added here. */
export const EVENT_DEFS: EventDefinition[] = [
  {
    type: "cron.social-11am.failure",
    label: "11am social run failure",
    description: "Daily FB / IG / YouTube social post cron (11:00 AEST).",
    default_enabled: true,
    default_severity: "critical",
  },
  {
    type: "cron.buffer-1130am.failure",
    label: "11:30am Buffer run failure",
    description: "TikTok + Pinterest followup posting via Buffer (11:30 AEST).",
    default_enabled: true,
    default_severity: "critical",
  },
  {
    type: "cron.ash-x.failure",
    label: "X/Twitter post run failure",
    description: "Ash X morning (9am) + afternoon (3pm) reply cycles.",
    default_enabled: true,
    default_severity: "critical",
  },
  {
    type: "cron.pinterest-blog-7pm.failure",
    label: "7pm Pinterest blog-pin failure",
    description: "Daily blog article Pinterest pin pipeline (19:02 AEST).",
    default_enabled: true,
    default_severity: "critical",
  },
  {
    type: "email.draft-ready",
    label: "New email draft ready",
    description: "Email draft pipeline has a campaign/reply ready for review.",
    default_enabled: true,
    default_severity: "info",
  },
  {
    type: "site.outage",
    label: "Site outage (non-200 homepage)",
    description: "Homepage health probe fired a non-200 response.",
    default_enabled: true,
    default_severity: "critical",
  },
  {
    type: "auth.registration.pending",
    label: "New user registration pending approval",
    description: "Someone submitted the /register form — needs admin approve/deny.",
    default_enabled: true,
    default_severity: "warn",
  },
  {
    type: "mu-plugins.rename-detected",
    label: "mu-plugins rename detected",
    description: "Safety watchdog — WP renamed mu-plugins → mu-plugins1 (the bug).",
    default_enabled: true,
    default_severity: "critical",
  },
];

/* Paths */
const DATA_DIR = path.join(process.cwd(), "data");
const HISTORY_PATH = path.join(DATA_DIR, "alerts.jsonl");
const SETTINGS_PATH = path.join(DATA_DIR, "alert-settings.json");
const WEBHOOK_PATH =
  process.env.MC_ALERTS_WEBHOOK_PATH ||
  path.join(process.env.HOME || "/home/nathan", ".openclaw/workspace/keys/mc-alerts-webhook.txt");

export interface AlertSettings {
  /* per-event-type on/off. Missing keys = use default_enabled from EVENT_DEFS. */
  toggles: Record<string, boolean>;
  /* quiet hours (AEST) — 24h strings like "21:00" + "07:00". Empty = no quiet hours. */
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  /* whether quiet hours respect severity (critical still pings during quiet hours) */
  quiet_hours_critical_bypass?: boolean;
}

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readSettings(): AlertSettings {
  ensureDirs();
  if (!fs.existsSync(SETTINGS_PATH)) {
    const seeded: AlertSettings = {
      toggles: Object.fromEntries(EVENT_DEFS.map((e) => [e.type, e.default_enabled])),
      quiet_hours_start: "",
      quiet_hours_end: "",
      quiet_hours_critical_bypass: true,
    };
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(seeded, null, 2) + "\n");
    return seeded;
  }
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
  } catch {
    return { toggles: {} };
  }
}

export function writeSettings(s: AlertSettings): void {
  ensureDirs();
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2) + "\n");
}

export function isEnabled(type: string, settings: AlertSettings): boolean {
  if (type in settings.toggles) return settings.toggles[type];
  const def = EVENT_DEFS.find((e) => e.type === type);
  // unknown types default OFF — store in history but don't forward. Prevents a rogue
  // cron (e.g. fairtraide-activity logging 503 API errors in its output) from spamming
  // Discord just because the wrapper's error-line grep caught "error" strings.
  // New event types must be added to EVENT_DEFS to be eligible for forwarding.
  return def ? def.default_enabled : false;
}

function isWithinQuietHours(settings: AlertSettings): boolean {
  const start = settings.quiet_hours_start;
  const end = settings.quiet_hours_end;
  if (!start || !end) return false;
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
  const h = now.getHours();
  const m = now.getMinutes();
  const cur = h * 60 + m;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = sh * 60 + (sm || 0);
  const endMin = eh * 60 + (em || 0);
  // Overnight window (e.g. 21:00 → 07:00)
  if (startMin > endMin) return cur >= startMin || cur < endMin;
  return cur >= startMin && cur < endMin;
}

export function appendHistory(evt: AlertEvent): void {
  ensureDirs();
  fs.appendFileSync(HISTORY_PATH, JSON.stringify(evt) + "\n");
}

/* Read the last N alerts from history. */
export function readHistory(limit = 100): AlertEvent[] {
  if (!fs.existsSync(HISTORY_PATH)) return [];
  const lines = fs.readFileSync(HISTORY_PATH, "utf-8").trim().split("\n").filter(Boolean);
  const tail = lines.slice(-limit);
  return tail.map((ln) => {
    try { return JSON.parse(ln) as AlertEvent; } catch { return null; }
  }).filter(Boolean) as AlertEvent[];
}

function loadWebhookUrl(eventType?: string): string | null {
  // Per-event override: approvals can route to a dedicated webhook so an
  // OBT/Allhart split is just an env var, not a code change.
  if (eventType === "auth.registration.pending") {
    const approval = (process.env.MC_APPROVAL_DISCORD_WEBHOOK || "").trim();
    if (approval.startsWith("https://")) return approval;
  }
  // Direct env URL (used on hosts without the keys/ file, e.g. OBT VPS).
  const envUrl = (process.env.MC_ALERTS_WEBHOOK_URL || "").trim();
  if (envUrl.startsWith("https://")) return envUrl;
  try {
    const raw = fs.readFileSync(WEBHOOK_PATH, "utf-8").trim();
    if (raw.startsWith("https://")) return raw;
  } catch { /* file missing, ignore */ }
  return null;
}

function severityEmoji(s: AlertSeverity): string {
  return { critical: "🚨", warn: "⚠️", info: "📋", success: "✅" }[s];
}

function formatForDiscord(evt: AlertEvent): { content: string } {
  const emoji = severityEmoji(evt.severity);
  const tail = evt.log_tail ? "\n```\n" + evt.log_tail.slice(0, 1400) + "\n```" : "";
  const ctx = evt.context && Object.keys(evt.context).length
    ? "\n`" + Object.entries(evt.context).map(([k, v]) => `${k}=${v}`).join(" ") + "`"
    : "";
  const content = `${emoji} **${evt.title}**  \`${evt.type}\`  (${evt.source})${ctx}${tail}`;
  return { content: content.slice(0, 1900) };
}

const DEBUG_PATH = path.join(DATA_DIR, "alerts-debug.jsonl");

function debugLog(entry: Record<string, unknown>): void {
  try {
    ensureDirs();
    fs.appendFileSync(
      DEBUG_PATH,
      JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n",
    );
  } catch { /* never throw from a debug logger */ }
}

/* Fire Discord webhook. Returns true on success, false on skip/failure. */
async function fireDiscord(evt: AlertEvent): Promise<boolean> {
  const url = loadWebhookUrl(evt.type);
  if (!url) {
    debugLog({
      stage: "no_url",
      type: evt.type,
      env_approval_set: Boolean((process.env.MC_APPROVAL_DISCORD_WEBHOOK || "").trim()),
      env_alerts_set: Boolean((process.env.MC_ALERTS_WEBHOOK_URL || "").trim()),
      keys_file_path: WEBHOOK_PATH,
      keys_file_exists: fs.existsSync(WEBHOOK_PATH),
    });
    return false;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formatForDiscord(evt)),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      debugLog({
        stage: "non_ok",
        type: evt.type,
        status: res.status,
        body: body.slice(0, 400),
        url_host: safeHost(url),
      });
    }
    return res.ok;
  } catch (e: unknown) {
    debugLog({
      stage: "fetch_threw",
      type: evt.type,
      error: e instanceof Error ? e.message : String(e),
      url_host: safeHost(url),
    });
    return false;
  }
}

function safeHost(u: string): string {
  try { return new URL(u).host; } catch { return "invalid"; }
}

export interface FanoutResult {
  stored: boolean;
  enabled: boolean;
  quiet_hours_skipped: boolean;
  discord_posted: boolean;
  discord_posted_ok: boolean;
}

/* Main entry — called by /api/alerts POST handler. */
export async function fanout(evtIn: AlertEvent): Promise<FanoutResult> {
  const evt: AlertEvent = { ...evtIn, received_at: new Date().toISOString() };
  appendHistory(evt);

  const settings = readSettings();
  const enabled = isEnabled(evt.type, settings);

  const quiet = isWithinQuietHours(settings);
  const bypass = evt.severity === "critical" && settings.quiet_hours_critical_bypass !== false;
  const quietSkipped = quiet && !bypass;

  if (!enabled) {
    return { stored: true, enabled: false, quiet_hours_skipped: false, discord_posted: false, discord_posted_ok: false };
  }
  if (quietSkipped) {
    return { stored: true, enabled: true, quiet_hours_skipped: true, discord_posted: false, discord_posted_ok: false };
  }

  const ok = await fireDiscord(evt);
  return { stored: true, enabled: true, quiet_hours_skipped: false, discord_posted: true, discord_posted_ok: ok };
}
