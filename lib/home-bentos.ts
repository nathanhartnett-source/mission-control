// Per-user customisable home bentos. Each bento has a free-text prompt that
// describes what it should display; an AI refresh job runs the prompt
// (with web search + light dashboard context) and stores a markdown result.
// Storage: data/home-bentos/<username>.json — array of HomeBento objects.

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { mcConfig } from "./mc-config";

export type HomeBento = {
  id: string;
  prompt: string;
  title?: string;            // short label rendered in the header
  result?: string;           // markdown content
  lastUpdated?: string;      // ISO ts
  refreshing?: boolean;      // currently being regenerated
  lastError?: string | null; // last refresh failure message
  frequencyHours: number;    // refresh cadence (default 12)
  createdAt: string;
};

const ROOT = path.join(mcConfig.dataRoot, "home-bentos");

function userFile(username: string): string {
  const safe = username.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return path.join(ROOT, `${safe || "anon"}.json`);
}

export function listBentos(username: string): HomeBento[] {
  try {
    const raw = JSON.parse(fs.readFileSync(userFile(username), "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

function writeBentos(username: string, list: HomeBento[]): void {
  fs.mkdirSync(ROOT, { recursive: true });
  fs.writeFileSync(userFile(username), JSON.stringify(list, null, 2), "utf8");
}

export function getBento(username: string, id: string): HomeBento | null {
  return listBentos(username).find((b) => b.id === id) || null;
}

export function createBento(username: string, prompt: string, frequencyHours = 12, title?: string): HomeBento {
  const list = listBentos(username);
  const b: HomeBento = {
    id: "b_" + crypto.randomBytes(4).toString("hex"),
    prompt: prompt.slice(0, 1000),
    title: title?.slice(0, 60),
    frequencyHours: Math.max(1, Math.min(168, frequencyHours)),
    createdAt: new Date().toISOString(),
  };
  list.push(b);
  writeBentos(username, list);
  return b;
}

export function updateBento(username: string, id: string, patch: Partial<HomeBento>): HomeBento | null {
  const list = listBentos(username);
  const i = list.findIndex((b) => b.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch, id: list[i].id };
  writeBentos(username, list);
  return list[i];
}

export function deleteBento(username: string, id: string): boolean {
  const list = listBentos(username);
  const next = list.filter((b) => b.id !== id);
  if (next.length === list.length) return false;
  writeBentos(username, next);
  return true;
}
