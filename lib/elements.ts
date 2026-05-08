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
  outputFormat: "markdown" | "pdf";
  letterhead?: ElementLetterhead;
  timeoutMin: number;
  shareWithOrg: boolean;
  createdAt: string;
  createdBy: string;
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
  pdfPath?: string;      // set when outputFormat=pdf and render succeeded
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
  const pdfFile = path.join(dir, "output.pdf");
  if (fs.existsSync(doneMarker)) {
    run.status = "done";
    run.endedAt = new Date().toISOString();
    if (fs.existsSync(outFile)) run.output = fs.readFileSync(outFile, "utf8").slice(0, 2_000_000);
    if (fs.existsSync(pdfFile)) run.pdfPath = pdfFile;
    persistRun(username, run);
  } else if (fs.existsSync(errMarker)) {
    run.status = "failed";
    run.endedAt = new Date().toISOString();
    run.error = fs.readFileSync(errMarker, "utf8").slice(0, 4000);
    if (fs.existsSync(outFile)) run.output = fs.readFileSync(outFile, "utf8").slice(0, 2_000_000);
    if (fs.existsSync(pdfFile)) run.pdfPath = pdfFile;
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
  }
  return out;
}

export function specLetterheadDir(username: string, slug: string): string {
  return path.join(userDir(username), "letterheads", slug);
}

export { runDir as _runDir, runsDir as _runsDir, userDir as _userDir };
