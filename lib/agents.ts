// Mission Control /agents — shared types + filesystem helpers.
// Spec: ~/wiki/concepts/mc-agents-tab.md

import { promises as fs } from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

export type AgentName = "ava" | "mia" | "ash" | "overseer" | "switchboard" | "me";
export type EnvelopeState = "queued" | "running" | "done" | "error";

export interface InboundEnvelope {
  schema: "mc-agent/v1";
  corr_id: string;
  agent: AgentName;
  ts: string;
  from: "mc-web";
  user: string;
  user_id?: string;
  text: string;
  display_text?: string;
  attachments: unknown[];
  context: { thread_id: string };
}

export type ThinkingEvent = { kind: "thinking" | "tool_use"; text: string; ts?: string };

export type Delegation = {
  to: "ava" | "ash" | "overseer";
  task: string;
  corr_id: string;
  ts: string;
};

export interface OutboundEnvelope {
  schema: "mc-agent-response/v1";
  corr_id: string;
  agent: AgentName;
  ts: string;
  state: EnvelopeState;
  text?: string;
  elapsed_ms?: number;
  error?: string | null;
  memory_saved?: string[];
  wiki_saved?: string[];
  skills_saved?: string[];
  thinking_events?: ThinkingEvent[];
  delegations?: Delegation[];
  // Live freshness/activity (only set on running.json by mc-agent-stream-parser.py).
  // Used by the chat UI to colour the thinking pill green/yellow/red and to flag
  // when an agent has flipped from research-mode (Read/Grep/etc) to mutation-mode.
  last_event_ts?: string;
  activity_kind?: "thinking" | "doing";
  current_tool?: string | null;
  // 30-40 char human-readable summary of the in-flight (or most recent) tool
  // input — e.g. "Edit lib/agents.ts", "Bash: npm run build". Sticky across
  // non-tool blocks so the disclosure can show "(3s ago)" while the agent
  // thinks/composes between tools. Cleared on terminal envelope states.
  current_tool_summary?: string | null;
  current_tool_summary_ts?: string | null;
}

export type AnyEnvelope = InboundEnvelope | OutboundEnvelope;

const HOME = os.homedir();

// Switchboard is a virtual routing-only agent — has no inbox/runner.
// We give it a placeholder path that won't be written to so type system
// stays happy without special-casing every consumer.
export const INBOX_DIRS: Record<AgentName, string> = {
  ava:         path.join(HOME, ".claude", "channels", "discord",    "inbox"),
  mia:         path.join(HOME, ".claude", "channels", "discord-b",  "inbox"),
  ash:         path.join(HOME, "wiki",     "_inbox"),
  overseer:    path.join(HOME, ".claude", "channels", "discord-os", "inbox"),
  switchboard: path.join(HOME, ".claude", "channels", "switchboard-virtual"),
  me:          path.join(HOME, ".claude", "channels", "user-virtual"),
};

export function userInboxDir(username: string): string {
  const u = username.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return path.join(HOME, ".claude", "channels", `user-${u}`, "inbox");
}

export const OUTBOX_DIR = path.join(HOME, "wiki", "_outbox", "mc-agent");
export const HISTORY_DIR = path.join(HOME, "legacy-workspace", "mission-control", "data", "agent-chat");
export const HISTORY_FILE = path.join(HISTORY_DIR, "messages.jsonl");
export const HISTORY_ARCHIVE_DIR = path.join(HISTORY_DIR, "archive");
const HISTORY_ACTIVE_DAYS = 90;
const HISTORY_ARCHIVE_DAYS = 365;

const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function ulid(): string {
  // Crockford-ish ULID: 10-char timestamp + 16-char random.
  const ts = Date.now();
  let out = "";
  let n = ts;
  for (let i = 9; i >= 0; i--) {
    out = ULID_ALPHABET[n & 31] + out;
    n = Math.floor(n / 32);
  }
  const rand = crypto.randomBytes(10);
  for (let i = 0; i < 16; i++) {
    out += ULID_ALPHABET[rand[i % 10] & 31];
  }
  return out;
}

async function pruneHistory(): Promise<void> {
  try {
    const raw = await fs.readFile(HISTORY_FILE, "utf-8");
    const lines = raw.split("\n").filter((line) => line.trim());
    if (lines.length === 0) return;

    const now = Date.now();
    const activeCutoff = now - HISTORY_ACTIVE_DAYS * 24 * 60 * 60 * 1000;
    const archiveCutoff = now - HISTORY_ARCHIVE_DAYS * 24 * 60 * 60 * 1000;
    const keep: string[] = [];
    const archiveByMonth = new Map<string, string[]>();

    for (const line of lines) {
      try {
        const env = JSON.parse(line) as InboundEnvelope;
        const ts = new Date(env.ts).getTime();
        if (!Number.isFinite(ts)) {
          keep.push(line);
          continue;
        }
        if (ts >= activeCutoff) {
          keep.push(line);
        } else if (ts >= archiveCutoff) {
          const d = new Date(ts);
          const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
          const arr = archiveByMonth.get(month) || [];
          arr.push(line);
          archiveByMonth.set(month, arr);
        }
      } catch {
        keep.push(line);
      }
    }

    for (const [month, archived] of archiveByMonth) {
      await fs.mkdir(HISTORY_ARCHIVE_DIR, { recursive: true });
      await fs.appendFile(path.join(HISTORY_ARCHIVE_DIR, `${month}.jsonl`), archived.join("\n") + "\n", "utf-8");
    }

    if (keep.length !== lines.length) {
      const tmp = `${HISTORY_FILE}.tmp-${process.pid}-${Date.now()}`;
      await fs.writeFile(tmp, keep.join("\n") + (keep.length ? "\n" : ""), "utf-8");
      await fs.rename(tmp, HISTORY_FILE);
    }

    // Best-effort archive retention: remove monthly archives older than HISTORY_ARCHIVE_DAYS.
    try {
      const files = await fs.readdir(HISTORY_ARCHIVE_DIR);
      for (const f of files) {
        const m = f.match(/^(\d{4})-(\d{2})\.jsonl$/);
        if (!m) continue;
        const archiveTs = Date.UTC(Number(m[1]), Number(m[2]) - 1, 1);
        if (archiveTs < archiveCutoff) await fs.unlink(path.join(HISTORY_ARCHIVE_DIR, f));
      }
    } catch { /* no archive yet */ }
  } catch { /* no history yet */ }
}

async function appendHistory(env: InboundEnvelope): Promise<void> {
  await fs.mkdir(HISTORY_DIR, { recursive: true });
  await fs.appendFile(HISTORY_FILE, JSON.stringify(env) + "\n", "utf-8");
  await pruneHistory();
}

export async function enqueue(agent: AgentName, text: string, opts?: { user?: string; user_id?: string; thread_id?: string; attachments?: unknown[]; agent_text?: string }): Promise<InboundEnvelope> {
  const corr_id = ulid();
  const env: InboundEnvelope = {
    schema: "mc-agent/v1",
    corr_id,
    agent,
    ts: new Date().toISOString(),
    from: "mc-web",
    user: opts?.user || "nathan",
    user_id: opts?.user_id || "nathan",
    text,
    attachments: opts?.attachments || [],
    context: { thread_id: opts?.thread_id || "default" },
  };
  const inboxEnv: InboundEnvelope = opts?.agent_text && opts.agent_text !== text
    ? { ...env, text: opts.agent_text, display_text: text }
    : env;
  const inboxDir = agent === "me" && opts?.user
    ? userInboxDir(opts.user)
    : INBOX_DIRS[agent];
  await fs.mkdir(inboxDir, { recursive: true });
  const file = path.join(inboxDir, `mc-agent-${agent}-${corr_id}.json`);
  const tmpFile = `${file}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmpFile, JSON.stringify(inboxEnv, null, 2), "utf-8");
  await fs.rename(tmpFile, file);

  // Also seed a "queued" outbox event so MC sees the message immediately,
  // even before the agent's runner fires. Agent will overwrite with running/done/error.
  await fs.mkdir(OUTBOX_DIR, { recursive: true });
  const queued: OutboundEnvelope = {
    schema: "mc-agent-response/v1",
    corr_id,
    agent,
    ts: env.ts,
    state: "queued",
  };
  await fs.writeFile(
    path.join(OUTBOX_DIR, `mc-agent-${corr_id}-queued.json`),
    JSON.stringify(queued, null, 2),
    "utf-8",
  );
  await appendHistory(env);
  return env;
}

export interface MessageRow {
  corr_id: string;
  agent: AgentName;
  user_text?: string;
  user_ts?: string;
  user?: string;
  user_id?: string;
  user_attachments?: { name: string; path: string; mime?: string; size?: number }[];
  agent_state?: EnvelopeState;
  agent_text?: string;
  agent_ts?: string;
  elapsed_ms?: number;
  error?: string | null;
  memory_saved?: string[];
  wiki_saved?: string[];
  skills_saved?: string[];
  thinking_events?: ThinkingEvent[];
  delegations?: Delegation[];
  last_event_ts?: string;
  activity_kind?: "thinking" | "doing";
  current_tool?: string | null;
  current_tool_summary?: string | null;
  current_tool_summary_ts?: string | null;
}

/**
 * Read all envelopes (inbound + outbound) and merge them into per-corr_id rows.
 * Returns rows sorted oldest-first.
 */
export async function readMessages(opts?: { sinceIso?: string; limit?: number; user?: string }): Promise<MessageRow[]> {
  const since = opts?.sinceIso ? new Date(opts.sinceIso).getTime() : 0;
  const limit = opts?.limit ?? 200;
  const userFilter = opts?.user ? opts.user.toLowerCase() : null;
  const rows: Map<string, MessageRow> = new Map();

  // Durable inbound history — processed inbox envelopes are deleted, so this
  // keeps Nathan's side of the conversation visible and available as context.
  try {
    const rawHistory = await fs.readFile(HISTORY_FILE, "utf-8");
    for (const line of rawHistory.split("\n")) {
      if (!line.trim()) continue;
      try {
        const env = JSON.parse(line) as InboundEnvelope;
        if (env.schema !== "mc-agent/v1") continue;
        if (since && new Date(env.ts).getTime() < since) continue;
        if (userFilter && (env.user || "nathan").toLowerCase() !== userFilter) continue;
        const r = rows.get(env.corr_id) || { corr_id: env.corr_id, agent: env.agent };
        r.user_text = env.display_text || env.text;
        r.user_ts = env.ts;
        r.user = env.user;
        r.user_id = env.user_id;
        r.user_attachments = Array.isArray(env.attachments) && env.attachments.length > 0
          ? (env.attachments as { name: string; path: string; mime?: string; size?: number }[])
          : undefined;
        rows.set(env.corr_id, r);
      } catch { /* skip malformed history row */ }
    }
  } catch { /* no history yet */ }

  // Bound disk reads to the most recent N files per dir. Without this, a
  // long-lived box accumulates thousands of envelope files and every /agents
  // page-load reads the lot. `cap` is generous enough to cover the requested
  // limit even if some files are stale partials.
  const cap = limit + 100;
  const newestFiles = async (dir: string): Promise<string[]> => {
    let files: string[];
    try { files = await fs.readdir(dir); } catch { return []; }
    const matched = files.filter((f) => f.startsWith("mc-agent-") && f.endsWith(".json"));
    if (matched.length <= cap) return matched;
    const stats = await Promise.all(matched.map(async (f) => {
      try { const s = await fs.stat(path.join(dir, f)); return { f, m: s.mtimeMs }; }
      catch { return { f, m: 0 }; }
    }));
    stats.sort((a, b) => b.m - a.m);
    return stats.slice(0, cap).map((s) => s.f);
  };

  // Inbound — read newest files per agent's inbox.
  for (const agent of Object.keys(INBOX_DIRS) as AgentName[]) {
    const dir = INBOX_DIRS[agent];
    const files = await newestFiles(dir);
    for (const f of files) {
      if (!f.startsWith("mc-agent-") || !f.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(dir, f), "utf-8");
        const env = JSON.parse(raw) as InboundEnvelope;
        if (env.schema !== "mc-agent/v1") continue;
        if (since && new Date(env.ts).getTime() < since) continue;
        if (userFilter && (env.user || "nathan").toLowerCase() !== userFilter) continue;
        const r = rows.get(env.corr_id) || { corr_id: env.corr_id, agent: env.agent };
        r.user_text = env.display_text || env.text;
        r.user_ts = env.ts;
        r.user = env.user;
        r.user_id = env.user_id;
        r.user_attachments = Array.isArray(env.attachments) && env.attachments.length > 0
          ? (env.attachments as { name: string; path: string; mime?: string; size?: number }[])
          : undefined;
        rows.set(env.corr_id, r);
      } catch { /* skip malformed */ }
    }
  }

  // Outbound — read newest envelopes from the shared outbox.
  const outFiles = await newestFiles(OUTBOX_DIR);
  for (const f of outFiles) {
    if (!f.startsWith("mc-agent-") || !f.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(OUTBOX_DIR, f), "utf-8");
      const env = JSON.parse(raw) as OutboundEnvelope;
      if (env.schema !== "mc-agent-response/v1") continue;
      if (since && new Date(env.ts).getTime() < since) continue;
      // When user-filtering, only attach outbound to rows whose inbound we already kept.
      if (userFilter && !rows.has(env.corr_id)) continue;
      const r = rows.get(env.corr_id) || { corr_id: env.corr_id, agent: env.agent };
      // Prefer terminal success over error if both files exist for a corr_id.
      // Races can create stale error files after the immediate runner already produced done.
      const order: Record<EnvelopeState, number> = { queued: 0, running: 1, error: 2, done: 3 };
      if (!r.agent_state || order[env.state] >= order[r.agent_state]) {
        r.agent_state = env.state;
        r.agent_text = env.text;
        r.agent_ts = env.ts;
        r.elapsed_ms = env.elapsed_ms;
        r.error = env.error ?? null;
        if (env.memory_saved && env.memory_saved.length > 0) r.memory_saved = env.memory_saved;
        if (env.wiki_saved && env.wiki_saved.length > 0) r.wiki_saved = env.wiki_saved;
        if (env.skills_saved && env.skills_saved.length > 0) r.skills_saved = env.skills_saved;
        if (env.thinking_events && env.thinking_events.length > 0) r.thinking_events = env.thinking_events;
        if (env.delegations && env.delegations.length > 0) r.delegations = env.delegations;
        // Live freshness fields are only meaningful while running. Clear them on
        // terminal states so a stale last_event_ts can't make a finished bubble
        // look "stuck".
        if (env.state === "running") {
          r.last_event_ts = env.last_event_ts;
          r.activity_kind = env.activity_kind;
          r.current_tool = env.current_tool ?? null;
          r.current_tool_summary = env.current_tool_summary ?? null;
          r.current_tool_summary_ts = env.current_tool_summary_ts ?? null;
        } else {
          r.last_event_ts = undefined;
          r.activity_kind = undefined;
          r.current_tool = undefined;
          r.current_tool_summary = undefined;
          r.current_tool_summary_ts = undefined;
        }
      }
      r.agent = env.agent;
      rows.set(env.corr_id, r);
    } catch { /* skip */ }
  }

  const sorted = Array.from(rows.values()).sort((a, b) => {
    const ta = a.user_ts || a.agent_ts || "";
    const tb = b.user_ts || b.agent_ts || "";
    return ta.localeCompare(tb);
  });
  return sorted.slice(-limit);
}
