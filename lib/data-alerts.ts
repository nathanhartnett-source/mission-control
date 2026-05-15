// Per-user list of "data alerts" — rule-driven (source + op + threshold)
// alerts evaluated periodically by a cron. Distinct from per-element AI
// alerts (those live in ElementSpec.alertCriterion).
//
// Storage: data/data-alerts/<username>.json — array of Alert objects.

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { mcConfig } from "./mc-config";
import type { AlertSourceId } from "./alert-sources";

const TIME_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function validateSchedule(s: unknown): ScheduleSpec | null {
  if (!s || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  const time = typeof o.time === "string" && TIME_RE.test(o.time) ? o.time : null;
  if (!time) return null;
  if (o.type === "once" && typeof o.date === "string" && DATE_RE.test(o.date)) return { type: "once", date: o.date, time };
  if (o.type === "daily") return { type: "daily", time };
  if (o.type === "weekly" && Array.isArray(o.daysOfWeek)) {
    const days = o.daysOfWeek.filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6);
    if (days.length > 0) return { type: "weekly", daysOfWeek: days, time };
  }
  if (o.type === "monthly" && Number.isInteger(o.dayOfMonth) && (o.dayOfMonth as number) >= 1 && (o.dayOfMonth as number) <= 31) {
    return { type: "monthly", dayOfMonth: o.dayOfMonth as number, time };
  }
  if (o.type === "monthly_nth_dow" && [1,2,3,4,-1].includes(o.week as number) && Number.isInteger(o.dayOfWeek) && (o.dayOfWeek as number) >= 0 && (o.dayOfWeek as number) <= 6) {
    return { type: "monthly_nth_dow", week: o.week as 1|2|3|4|-1, dayOfWeek: o.dayOfWeek as number, time };
  }
  return null;
}

export function describeSchedule(s: ScheduleSpec | undefined, legacyTime?: string, legacyDows?: number[]): string {
  if (!s) {
    if (legacyTime) {
      const dows = legacyDows && legacyDows.length > 0 && legacyDows.length < 7
        ? ` (${legacyDows.map(d => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d]).join(", ")})`
        : "";
      return `Daily at ${legacyTime} AEST${dows}`;
    }
    return "(no schedule)";
  }
  const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const WEEK_LABELS: Record<number,string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", [-1]: "last" };
  switch (s.type) {
    case "once": return `Once at ${s.time} AEST on ${s.date}`;
    case "daily": return `Every day at ${s.time} AEST`;
    case "weekly": return `${s.daysOfWeek.map(d => DOW[d]).join(", ")} at ${s.time} AEST`;
    case "monthly": return `Day ${s.dayOfMonth} of each month at ${s.time} AEST`;
    case "monthly_nth_dow": return `${WEEK_LABELS[s.week]} ${DOW[s.dayOfWeek]} of each month at ${s.time} AEST`;
  }
}

export type ScheduleSpec =
  | { type: "once"; date: string; time: string }                                    // one-off, never repeats
  | { type: "daily"; time: string }                                                  // every day
  | { type: "weekly"; daysOfWeek: number[]; time: string }                           // chosen weekdays (Sun=0..Sat=6)
  | { type: "monthly"; dayOfMonth: number; time: string }                            // e.g. 15th of each month
  | { type: "monthly_nth_dow"; week: 1 | 2 | 3 | 4 | -1; dayOfWeek: number; time: string }; // e.g. last Friday

export type DataAlert = {
  id: string;
  owner: string;
  // kind=data uses source+dims+op+threshold (rule-based threshold alert).
  // kind=research uses prompt+frequencyHours (Claude web-research run on a schedule).
  // kind=reminder uses cronTime + daysOfWeek (fires a fixed message on a schedule).
  kind?: "data" | "research" | "reminder";
  source?: AlertSourceId;
  dims?: Record<string, string>;
  op?: "<" | "<=" | ">" | ">=";
  threshold?: number;
  // research-specific
  prompt?: string;
  frequencyHours?: number;
  // reminder-specific
  reminderText?: string;   // The message to deliver on schedule
  schedule?: ScheduleSpec; // Rich schedule. All times Brisbane (no DST).
  // Legacy fields kept for backward-compatibility with v1 reminders.
  cronTime?: string;       // legacy: "HH:MM" in Australia/Brisbane
  daysOfWeek?: number[];   // legacy: 0=Sun..6=Sat. Empty/undefined => all 7
  lastEvaluatedAt?: string;
  lastFindingSummary?: string;
  // The user's original natural-language brief. When present, the evaluator
  // hands this + the fetched values to Sonnet to decide whether to fire,
  // instead of using rigid compareValue. Threshold + op stay as hints.
  intent?: string;
  // Plain-English one-line summary the AI wrote during creation/edit. Shown
  // in the list instead of the structured spec.
  summary?: string;
  // common
  cooldownHours: number;
  minConsecutiveSamples?: number;
  consecutiveCount?: number;
  lastFiredAt?: string;
  lastValue?: number | null;
  createdAt: string;
  label?: string;
  active: boolean;
};

const ROOT = path.join(mcConfig.dataRoot, "data-alerts");

function userFile(username: string): string {
  const safe = username.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return path.join(ROOT, `${safe || "anon"}.json`);
}

function readUserAlerts(username: string): DataAlert[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(userFile(username), "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeUserAlerts(username: string, list: DataAlert[]): void {
  fs.mkdirSync(ROOT, { recursive: true });
  fs.writeFileSync(userFile(username), JSON.stringify(list, null, 2), "utf8");
}

export function listDataAlerts(username: string): DataAlert[] { return readUserAlerts(username); }

export function getDataAlert(username: string, id: string): DataAlert | null {
  return readUserAlerts(username).find((a) => a.id === id) || null;
}

export function createDataAlert(
  username: string,
  partial: Omit<DataAlert, "id" | "createdAt" | "owner" | "active" | "cooldownHours"> & Partial<Pick<DataAlert, "active" | "cooldownHours">>,
): DataAlert {
  const list = readUserAlerts(username);
  const alert: DataAlert = {
    id: "a_" + crypto.randomBytes(4).toString("hex"),
    owner: username,
    active: partial.active ?? true,
    cooldownHours: partial.cooldownHours ?? 24,
    createdAt: new Date().toISOString(),
    ...partial,
  };
  list.push(alert);
  writeUserAlerts(username, list);
  return alert;
}

export function updateDataAlert(username: string, id: string, patch: Partial<DataAlert>): DataAlert | null {
  const list = readUserAlerts(username);
  const i = list.findIndex((a) => a.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch, id: list[i].id, owner: list[i].owner };
  writeUserAlerts(username, list);
  return list[i];
}

export function deleteDataAlert(username: string, id: string): boolean {
  const list = readUserAlerts(username);
  const next = list.filter((a) => a.id !== id);
  if (next.length === list.length) return false;
  writeUserAlerts(username, next);
  return true;
}

export function listAllDataAlerts(): DataAlert[] {
  if (!fs.existsSync(ROOT)) return [];
  const out: DataAlert[] = [];
  for (const f of fs.readdirSync(ROOT)) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
      if (Array.isArray(raw)) out.push(...raw);
    } catch {}
  }
  return out;
}
