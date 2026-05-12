// Per-user inbox for agent → user alerts. Storage: one JSON file per message
// under data/inbox/<username>/<id>.json. Sorted by id (lexicographic ULID-ish).

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { mcConfig } from "./mc-config";

export type InboxMessage = {
  id: string;
  from: string;             // sender label (e.g. "Ava", "Mia", "Overseer")
  subject: string;
  body: string;             // plain text or markdown
  href?: string;            // optional deep-link the user can open
  level?: "info" | "warn" | "error" | "success";
  read: boolean;
  ts: string;               // ISO timestamp
};

const ROOT = path.join(mcConfig.dataRoot, "inbox");

function userDir(username: string): string {
  const safe = username.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return path.join(ROOT, safe || "anon");
}

export function newMessageId(): string {
  // Sortable by ts: prefix with reverse timestamp + random bytes
  const ts = Date.now().toString(36).padStart(9, "0");
  return `${ts}-${crypto.randomBytes(4).toString("hex")}`;
}

export function listMessages(username: string, opts?: { unreadOnly?: boolean; limit?: number }): InboxMessage[] {
  const dir = userDir(username);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const msgs: InboxMessage[] = [];
  for (const f of files) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as InboxMessage;
      if (opts?.unreadOnly && m.read) continue;
      msgs.push(m);
    } catch {}
  }
  msgs.sort((a, b) => (b.id < a.id ? -1 : 1));
  if (opts?.limit) return msgs.slice(0, opts.limit);
  return msgs;
}

export function unreadCount(username: string): number {
  return listMessages(username, { unreadOnly: true }).length;
}

export function postMessage(username: string, partial: Omit<InboxMessage, "id" | "ts" | "read">): InboxMessage {
  const dir = userDir(username);
  fs.mkdirSync(dir, { recursive: true });
  const msg: InboxMessage = {
    id: newMessageId(),
    ts: new Date().toISOString(),
    read: false,
    ...partial,
  };
  fs.writeFileSync(path.join(dir, `${msg.id}.json`), JSON.stringify(msg, null, 2), "utf8");
  return msg;
}

export function markRead(username: string, id: string, read = true): InboxMessage | null {
  const file = path.join(userDir(username), `${id}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const m = JSON.parse(fs.readFileSync(file, "utf8")) as InboxMessage;
    m.read = read;
    fs.writeFileSync(file, JSON.stringify(m, null, 2), "utf8");
    return m;
  } catch {
    return null;
  }
}

export function markAllRead(username: string): number {
  const msgs = listMessages(username, { unreadOnly: true });
  for (const m of msgs) markRead(username, m.id, true);
  return msgs.length;
}

export function deleteMessage(username: string, id: string): boolean {
  const file = path.join(userDir(username), `${id}.json`);
  try { fs.unlinkSync(file); return true; } catch { return false; }
}
