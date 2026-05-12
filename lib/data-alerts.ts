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

export type DataAlert = {
  id: string;
  owner: string;
  // kind=data uses source+dims+op+threshold (rule-based threshold alert).
  // kind=research uses prompt+frequencyHours (Claude web-research run on a schedule).
  kind?: "data" | "research";
  source?: AlertSourceId;
  dims?: Record<string, string>;
  op?: "<" | "<=" | ">" | ">=";
  threshold?: number;
  // research-specific
  prompt?: string;
  frequencyHours?: number;
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
