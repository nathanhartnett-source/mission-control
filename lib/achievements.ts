/**
 * Per-user achievements / milestone tracker.
 * Stored in ~/.claude/projects/-home-<username>/memory/achievements.json
 *
 *   { counters: { [kind]: number }, awarded: [{ id, ts }], lastSeen: number }
 *
 * lastSeen = index in `awarded` up to which the client has been notified.
 * Used by the peek endpoint to drive the big-then-fade unlock animation.
 */
import fs from "fs";
import path from "path";
import { memoryDir } from "./workspace";

export type Counter =
  | "messages"
  | "tasks_done"
  | "streak_days"
  | "wiki_edits"
  | "agent_trains"
  | "avatar_rolls";

export type Achievement = {
  id: string;
  counter: Counter;
  threshold: number;
  title: string;
  blurb: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  // Glyph hint for the badge generator — keeps each badge visually distinct.
  glyph: "chat" | "scroll" | "flame" | "brain" | "ship" | "sparkle";
};

export const CATALOG: Achievement[] = [
  // Conversation
  { id: "chat-10",   counter: "messages", threshold: 10,   title: "First Words",     blurb: "10 messages sent",   tier: "bronze",   glyph: "chat" },
  { id: "chat-50",   counter: "messages", threshold: 50,   title: "Conversational",  blurb: "50 messages sent",   tier: "silver",   glyph: "chat" },
  { id: "chat-250",  counter: "messages", threshold: 250,  title: "Power User",      blurb: "250 messages sent",  tier: "gold",     glyph: "chat" },
  { id: "chat-1000", counter: "messages", threshold: 1000, title: "Always On",       blurb: "1,000 messages sent",tier: "platinum", glyph: "chat" },

  // Wiki — encourage knowledge capture
  { id: "wiki-1",   counter: "wiki_edits", threshold: 1,   title: "First Page",       blurb: "First wiki edit",        tier: "bronze",   glyph: "scroll" },
  { id: "wiki-10",  counter: "wiki_edits", threshold: 10,  title: "Scribe",            blurb: "10 wiki edits",          tier: "silver",   glyph: "scroll" },
  { id: "wiki-50",  counter: "wiki_edits", threshold: 50,  title: "Lorekeeper",        blurb: "50 wiki edits",          tier: "gold",     glyph: "scroll" },
  { id: "wiki-200", counter: "wiki_edits", threshold: 200, title: "Cartographer",     blurb: "200 wiki edits",         tier: "platinum", glyph: "scroll" },

  // Agent training — memories saved, persona tweaks, agent reroll
  { id: "train-1",  counter: "agent_trains", threshold: 1,  title: "Trainer",          blurb: "Trained your agent",     tier: "bronze",   glyph: "brain" },
  { id: "train-10", counter: "agent_trains", threshold: 10, title: "Mentor",           blurb: "10 agent trainings",     tier: "silver",   glyph: "brain" },
  { id: "train-50", counter: "agent_trains", threshold: 50, title: "Whisperer",        blurb: "50 agent trainings",     tier: "gold",     glyph: "brain" },

  // Streak
  { id: "streak-3",  counter: "streak_days", threshold: 3,  title: "Warming Up",      blurb: "3-day streak",           tier: "bronze",   glyph: "flame" },
  { id: "streak-7",  counter: "streak_days", threshold: 7,  title: "Week Strong",     blurb: "7-day streak",           tier: "silver",   glyph: "flame" },
  { id: "streak-30", counter: "streak_days", threshold: 30, title: "Habit Formed",    blurb: "30-day streak",          tier: "gold",     glyph: "flame" },
  { id: "streak-100",counter: "streak_days", threshold: 100,title: "Centurion",       blurb: "100-day streak",         tier: "platinum", glyph: "flame" },

  // Tasks shipped
  { id: "ship-5",   counter: "tasks_done", threshold: 5,   title: "Shipper",          blurb: "5 tasks shipped",        tier: "bronze",   glyph: "ship" },
  { id: "ship-25",  counter: "tasks_done", threshold: 25,  title: "Closer",           blurb: "25 tasks shipped",       tier: "silver",   glyph: "ship" },
  { id: "ship-100", counter: "tasks_done", threshold: 100, title: "Operator",         blurb: "100 tasks shipped",      tier: "gold",     glyph: "ship" },

  // Stylist — feel-good first reroll
  { id: "style-1",  counter: "avatar_rolls", threshold: 1, title: "Stylist",          blurb: "Re-rolled an avatar",    tier: "bronze",   glyph: "sparkle" },
];

export type Awarded = { id: string; ts: string };
export type State = {
  counters: Partial<Record<Counter, number>>;
  awarded: Awarded[];
  lastSeen: number;
};

function file(username: string): string {
  return path.join(memoryDir(username.toLowerCase()), "achievements.json");
}

function read(username: string): State {
  try {
    const raw = fs.readFileSync(file(username), "utf8");
    const p = JSON.parse(raw);
    return {
      counters: p.counters || {},
      awarded: Array.isArray(p.awarded) ? p.awarded : [],
      lastSeen: typeof p.lastSeen === "number" ? p.lastSeen : 0,
    };
  } catch {
    return { counters: {}, awarded: [], lastSeen: 0 };
  }
}

function write(username: string, s: State): void {
  const f = file(username);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(s, null, 2));
}

/**
 * Bump a counter and award any newly-crossed milestones. Returns the freshly
 * awarded achievements (may be empty). Pass `set` to set the counter to an
 * absolute value (e.g. streak_days), otherwise it increments by `by` (default 1).
 */
export function bump(
  username: string,
  counter: Counter,
  opts: { by?: number; set?: number } = {},
): Achievement[] {
  const s = read(username);
  const prev = s.counters[counter] || 0;
  const next = typeof opts.set === "number" ? opts.set : prev + (opts.by ?? 1);
  if (next === prev) return [];
  s.counters[counter] = next;
  const already = new Set(s.awarded.map((a) => a.id));
  const newly: Achievement[] = [];
  for (const a of CATALOG) {
    if (a.counter !== counter) continue;
    if (already.has(a.id)) continue;
    if (next >= a.threshold) {
      s.awarded.push({ id: a.id, ts: new Date().toISOString() });
      newly.push(a);
    }
  }
  write(username, s);
  return newly;
}

export function listAwarded(username: string): { achievements: Achievement[]; counters: State["counters"] } {
  const s = read(username);
  const byId = new Map(CATALOG.map((a) => [a.id, a]));
  const achievements = s.awarded
    .map((a) => byId.get(a.id))
    .filter((a): a is Achievement => !!a);
  return { achievements, counters: s.counters };
}

/** Return achievements awarded since lastSeen, then advance lastSeen. */
export function peek(username: string): Achievement[] {
  const s = read(username);
  if (s.lastSeen >= s.awarded.length) return [];
  const fresh = s.awarded.slice(s.lastSeen);
  s.lastSeen = s.awarded.length;
  write(username, s);
  const byId = new Map(CATALOG.map((a) => [a.id, a]));
  return fresh.map((a) => byId.get(a.id)).filter((a): a is Achievement => !!a);
}
