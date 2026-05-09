/**
 * User-built "Elements" — tier-2 sandboxed prompt-apps.
 *
 * A spec describes a form + agent prompt + output. Saved per-user; can be
 * shared with the org. Runs spawn a one-shot `claude -p` worker with a
 * restricted toolset (web + read-only filesystem only).
 */
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

const DATA_ROOT = path.join(os.homedir(), ".openclaw", "workspace", "mission-control", "data", "user-elements");

export type ElementInput = {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "file";
  required: boolean;
  options?: string[];
  placeholder?: string;
  // file-only:
  acceptMime?: string;   // e.g. "image/*,application/pdf"
  maxMB?: number;        // default 20
};

export type ElementLetterhead = {
  mode: "none" | "upload";
  imagePath?: string;    // absolute path to letterhead image stored alongside spec
};

export type ElementSpec = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  inputs: ElementInput[];
  promptTemplate: string;
  outputFormat: "markdown" | "pdf" | "xlsx" | "pptx";
  letterhead?: ElementLetterhead;
  timeoutMin: number;
  shareWithOrg: boolean;
  createdAt: string;
  createdBy: string;
  schedule?: ElementSchedule;
};

export type ElementSchedule = {
  freq: "daily" | "weekly" | "monthly";
  time: string;             // "HH:MM" 24h, server-local
  dayOfWeek?: number;       // 0=Sun..6=Sat, weekly only
  dayOfMonth?: number;      // 1..28, monthly only
  inputs: Record<string, string>; // pre-filled inputs to use on each scheduled run
  lastRunAt?: string;       // ISO timestamp of last fire
  nextRunAt?: string;       // ISO timestamp of next due fire (computed at save)
};

export type ElementRun = {
  id: string;
  slug: string;
  username: string;
  inputs: Record<string, string>;
  status: "running" | "done" | "failed" | "killed";
  startedAt: string;
  endedAt?: string;
  pid?: number;
  output?: string;
  error?: string;
  pdfPath?: string;      // path to rendered binary output (pdf/xlsx/pptx); name kept for back-compat
  outputExt?: "pdf" | "xlsx" | "pptx";  // matches the rendered file extension
};

function userDir(username: string): string {
  return path.join(DATA_ROOT, username.toLowerCase());
}

function runsDir(username: string): string {
  return path.join(userDir(username), "runs");
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function newRunId(): string {
  return Date.now().toString(36) + "-" + crypto.randomBytes(4).toString("hex");
}

export function listElements(username: string): ElementSpec[] {
  const dir = userDir(username);
  if (!fs.existsSync(dir)) return [];
  const out: ElementSpec[] = [];
  for (const f of fs.readdirSync(dir)) {
    // Skip dotfiles (.pinned.json, .DS_Store, etc) — they're sidecar config,
    // not specs. Without this guard, .pinned.json (an array) was being parsed
    // as a spec and rendered as a blank card with just an icon.
    if (f.startsWith(".")) continue;
    if (!f.endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.slug) {
        out.push(parsed);
      }
    } catch {}
  }
  // Also include shared (from other users marked shareWithOrg)
  if (fs.existsSync(DATA_ROOT)) {
    for (const otherUser of fs.readdirSync(DATA_ROOT)) {
      if (otherUser === username.toLowerCase()) continue;
      const otherDir = path.join(DATA_ROOT, otherUser);
      if (!fs.statSync(otherDir).isDirectory()) continue;
      for (const f of fs.readdirSync(otherDir)) {
        if (f.startsWith(".")) continue;
        if (!f.endsWith(".json")) continue;
        try {
          const parsed = JSON.parse(fs.readFileSync(path.join(otherDir, f), "utf8"));
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !parsed.slug) continue;
          const spec = parsed as ElementSpec;
          if (spec.shareWithOrg && !out.find(x => x.slug === spec.slug)) out.push(spec);
        } catch {}
      }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function getElement(username: string, slug: string): ElementSpec | null {
  // Try own first, then shared
  const own = path.join(userDir(username), `${slug}.json`);
  if (fs.existsSync(own)) {
    try { return JSON.parse(fs.readFileSync(own, "utf8")); } catch {}
  }
  if (fs.existsSync(DATA_ROOT)) {
    for (const otherUser of fs.readdirSync(DATA_ROOT)) {
      const f = path.join(DATA_ROOT, otherUser, `${slug}.json`);
      if (fs.existsSync(f)) {
        try {
          const spec: ElementSpec = JSON.parse(fs.readFileSync(f, "utf8"));
          if (spec.shareWithOrg) return spec;
        } catch {}
      }
    }
  }
  return null;
}

export function saveElement(username: string, spec: ElementSpec): void {
  const dir = userDir(username);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${spec.slug}.json`), JSON.stringify(spec, null, 2), "utf8");
}

export function deleteElement(username: string, slug: string): boolean {
  const f = path.join(userDir(username), `${slug}.json`);
  if (!fs.existsSync(f)) return false;
  fs.unlinkSync(f);
  // Also drop the slug from pinned list (no-op if not pinned).
  setPinned(username, slug, false);
  return true;
}

/**
 * Update the human-visible `name` on a saved element. Slug stays stable so
 * URLs and run history don't break. Only the element's creator can rename.
 */
export function renameElement(username: string, slug: string, newName: string): boolean {
  const f = path.join(userDir(username), `${slug}.json`);
  if (!fs.existsSync(f)) return false;
  try {
    const spec: ElementSpec = JSON.parse(fs.readFileSync(f, "utf8"));
    spec.name = newName.trim().slice(0, 60) || spec.name;
    fs.writeFileSync(f, JSON.stringify(spec, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Per-user pinned-app list. Stored at `<userDir>/.pinned.json` as an array of
 * slugs. The Nav reads this to render pinned apps as additional menu items.
 */
function pinnedFile(username: string): string {
  return path.join(userDir(username), ".pinned.json");
}
export function listPinned(username: string): string[] {
  const f = pinnedFile(username);
  if (!fs.existsSync(f)) return [];
  try {
    const arr = JSON.parse(fs.readFileSync(f, "utf8"));
    return Array.isArray(arr) ? arr.filter(s => typeof s === "string") : [];
  } catch {
    return [];
  }
}
export function setPinned(username: string, slug: string, pinned: boolean): void {
  const dir = userDir(username);
  fs.mkdirSync(dir, { recursive: true });
  let arr = listPinned(username);
  if (pinned && !arr.includes(slug)) arr.push(slug);
  if (!pinned) arr = arr.filter(s => s !== slug);
  fs.writeFileSync(pinnedFile(username), JSON.stringify(arr, null, 2), "utf8");
}

function runDir(username: string, runId: string): string {
  return path.join(runsDir(username), runId);
}

export function listRuns(username: string, slug: string): ElementRun[] {
  const dir = runsDir(username);
  if (!fs.existsSync(dir)) return [];
  const out: ElementRun[] = [];
  for (const id of fs.readdirSync(dir)) {
    const meta = path.join(dir, id, "meta.json");
    if (!fs.existsSync(meta)) continue;
    try {
      const run: ElementRun = JSON.parse(fs.readFileSync(meta, "utf8"));
      if (run.slug === slug) out.push(refreshRun(username, run));
    } catch {}
  }
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function getRun(username: string, runId: string): ElementRun | null {
  const meta = path.join(runDir(username, runId), "meta.json");
  if (!fs.existsSync(meta)) return null;
  try {
    const run: ElementRun = JSON.parse(fs.readFileSync(meta, "utf8"));
    return refreshRun(username, run);
  } catch { return null; }
}

function refreshRun(username: string, run: ElementRun): ElementRun {
  if (run.status !== "running") return run;
  const dir = runDir(username, run.id);
  const doneMarker = path.join(dir, "done");
  const errMarker = path.join(dir, "error");
  const outFile = path.join(dir, "output.md");
  const renderedExt = (["pdf", "xlsx", "pptx"] as const).find(e => fs.existsSync(path.join(dir, `output.${e}`)));
  const renderedFile = renderedExt ? path.join(dir, `output.${renderedExt}`) : null;
  if (fs.existsSync(doneMarker)) {
    run.status = "done";
    run.endedAt = new Date().toISOString();
    if (fs.existsSync(outFile)) run.output = fs.readFileSync(outFile, "utf8").slice(0, 2_000_000);
    if (renderedFile) { run.pdfPath = renderedFile; run.outputExt = renderedExt; }
    persistRun(username, run);
  } else if (fs.existsSync(errMarker)) {
    run.status = "failed";
    run.endedAt = new Date().toISOString();
    run.error = fs.readFileSync(errMarker, "utf8").slice(0, 4000);
    if (fs.existsSync(outFile)) run.output = fs.readFileSync(outFile, "utf8").slice(0, 2_000_000);
    if (renderedFile) { run.pdfPath = renderedFile; run.outputExt = renderedExt; }
    persistRun(username, run);
  } else if (run.pid && !pidAlive(run.pid)) {
    // Process gone but no marker — treat as failed
    run.status = "failed";
    run.endedAt = new Date().toISOString();
    run.error = "Worker exited without writing result";
    if (fs.existsSync(outFile)) run.output = fs.readFileSync(outFile, "utf8").slice(0, 2_000_000);
    persistRun(username, run);
  }
  return run;
}

function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export function persistRun(username: string, run: ElementRun): void {
  const dir = runDir(username, run.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(run, null, 2), "utf8");
}

export function killRun(username: string, runId: string): boolean {
  const run = getRun(username, runId);
  if (!run || run.status !== "running" || !run.pid) return false;
  try { process.kill(-run.pid, "SIGTERM"); } catch {}
  try { process.kill(run.pid, "SIGTERM"); } catch {}
  run.status = "killed";
  run.endedAt = new Date().toISOString();
  persistRun(username, run);
  return true;
}

export function renderPrompt(spec: ElementSpec, inputs: Record<string, string>): string {
  let out = spec.promptTemplate;
  for (const inp of spec.inputs) {
    const v = (inputs[inp.name] ?? "").toString();
    out = out.split(`{{${inp.name}}}`).join(v);
  }
  if (spec.outputFormat === "pdf") {
    out += `\n\n---\nIMPORTANT: This output will be rendered to PDF. Produce well-structured Markdown with clear headings (#, ##), bullet lists, and tables (|---|). For charts, embed a fenced block with language \`chart\` containing valid Chart.js JSON config, e.g.:\n\n\`\`\`chart\n{"type":"bar","data":{"labels":["A","B","C"],"datasets":[{"label":"Sales","data":[10,20,15]}]},"options":{"plugins":{"title":{"display":true,"text":"Weekly sales"}}}}\n\`\`\`\n\nOnly produce charts when the data genuinely benefits from visualisation. Don't fabricate data; if a chart would need numbers you don't have, leave it out.`;
  } else if (spec.outputFormat === "xlsx") {
    out += `\n\n---\nIMPORTANT: This output will be rendered to an Excel (.xlsx) workbook. Output ONE OR MORE fenced blocks with language \`sheet:<TabName>\` containing CSV-formatted data (header row first). Example:\n\n\`\`\`sheet:Summary\nMetric,Value\nTotal sales,12345\nOrders,87\n\`\`\`\n\n\`\`\`sheet:Orders\nOrder ID,Customer,Total\n1001,Acme,250.00\n1002,Globex,1100.00\n\`\`\`\n\nOne fenced block per worksheet tab. CSV values may be wrapped in double-quotes if they contain commas. You may also include a brief markdown summary OUTSIDE the fenced blocks — that text is ignored by the renderer. Don't fabricate data; if you can't fill a tab honestly, omit it.`;
  } else if (spec.outputFormat === "pptx") {
    out += `\n\n---\nIMPORTANT: This output will be rendered to a PowerPoint (.pptx) deck. Output ONE OR MORE fenced blocks with language \`slide\` containing a JSON object per slide. Example:\n\n\`\`\`slide\n{"title":"Q3 Recap","bullets":["Revenue up 12%","Two new clients","Team expanded to 14"]}\n\`\`\`\n\n\`\`\`slide\n{"title":"What's next","bullets":["Launch portal","Hire ops lead","Close partnership"],"notes":"Speaker notes here"}\n\`\`\`\n\nSchema per slide: {title: string, bullets?: string[], body?: string, notes?: string}. Use \`bullets\` for bulleted lists, \`body\` for a paragraph, both can co-exist. One fenced block per slide, in order. Keep it concise — slides aren't documents.`;
  }
  return out;
}

export function specLetterheadDir(username: string, slug: string): string {
  return path.join(userDir(username), "letterheads", slug);
}

export { runDir as _runDir, runsDir as _runsDir, userDir as _userDir };

/**
 * Compute the next ISO timestamp this schedule should fire, relative to `now`.
 * Wall-clock time is interpreted in `tz` (IANA zone, e.g. "Australia/Brisbane").
 */
function tzOffsetMin(tz: string, atUtcMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(atUtcMs));
  const get = (k: string) => Number(parts.find(p => p.type === k)?.value || "0");
  const wallUtcMs = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return (wallUtcMs - atUtcMs) / 60000;
}
function wallToUtc(tz: string, y: number, m: number, d: number, hh: number, mm: number): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = tzOffsetMin(tz, guess);
  return new Date(guess - offset * 60000);
}
function wallParts(tz: string, instant: Date) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short",
  });
  const parts = dtf.formatToParts(instant);
  const get = (k: string) => parts.find(p => p.type === k)?.value || "";
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    dow: dowMap[get("weekday")] ?? 0,
  };
}
export function computeNextRunAt(s: ElementSchedule, tz: string = "UTC", now: Date = new Date()): string {
  const [hhStr, mmStr] = (s.time || "09:00").split(":");
  const hh = isFinite(+hhStr) ? +hhStr : 9;
  const mm = isFinite(+mmStr) ? +mmStr : 0;
  const cur = wallParts(tz, now);
  if (s.freq === "daily") {
    let cand = wallToUtc(tz, cur.year, cur.month, cur.day, hh, mm);
    if (cand <= now) cand = wallToUtc(tz, cur.year, cur.month, cur.day + 1, hh, mm);
    return cand.toISOString();
  }
  if (s.freq === "weekly") {
    const target = typeof s.dayOfWeek === "number" ? ((s.dayOfWeek % 7) + 7) % 7 : 1;
    let delta = (target - cur.dow + 7) % 7;
    let cand = wallToUtc(tz, cur.year, cur.month, cur.day + delta, hh, mm);
    if (cand <= now) cand = wallToUtc(tz, cur.year, cur.month, cur.day + delta + 7, hh, mm);
    return cand.toISOString();
  }
  // monthly
  const targetD = Math.max(1, Math.min(28, s.dayOfMonth || 1));
  let cand = wallToUtc(tz, cur.year, cur.month, targetD, hh, mm);
  if (cand <= now) cand = wallToUtc(tz, cur.year, cur.month + 1, targetD, hh, mm);
  return cand.toISOString();
}

/** Walks every user dir, returning [username, spec] pairs for specs with a schedule. */
export function listAllScheduled(): Array<{ username: string; spec: ElementSpec }> {
  const out: Array<{ username: string; spec: ElementSpec }> = [];
  if (!fs.existsSync(DATA_ROOT)) return out;
  for (const userName of fs.readdirSync(DATA_ROOT)) {
    const dir = path.join(DATA_ROOT, userName);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith(".") || !f.endsWith(".json")) continue;
      try {
        const spec: ElementSpec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
        if (spec?.schedule?.freq) out.push({ username: userName, spec });
      } catch {}
    }
  }
  return out;
}
