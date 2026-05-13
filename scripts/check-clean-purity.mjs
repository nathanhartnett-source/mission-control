#!/usr/bin/env node
// Clean-repo purity check. Greps for forbidden tokens that indicate
// brand-specific business logic or operator-specific paths leaking
// into the core platform. Exit 1 if any are found.
//
// Usage:
//   node scripts/check-clean-purity.mjs            — lint files CHANGED vs origin/main (default)
//   node scripts/check-clean-purity.mjs --all      — full repo audit (surfaces legacy)
//   node scripts/check-clean-purity.mjs --staged   — lint git-staged files (pre-commit)
//
// Pre-push hook: runs the default (changed) mode so new commits can't
// add new leakage; existing legacy stays until incrementally cleaned.
//
// See CLEAN.md for the contract.

import { readdirSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const MODE = process.argv.includes("--all") ? "all"
           : process.argv.includes("--staged") ? "staged"
           : "changed";

// Forbidden tokens grouped by match strategy.
//
// WORD tokens use \b word boundaries so "mro" doesn't match inside SHA
// hashes or "NavPrefs". STRING tokens are plain substring matches for
// paths and longer phrases unlikely to collide.
const WORD_TOKENS = [
  // Allhart brand names + per-brand products
  "allhart", "mro", "bmo", "fob", "helix", "avp", "blc", "ahub",
  "fairtraide", "bentoframe",
  // Per-brand workflows / staff names
  "acb", "funnelkit", "tessa", "louisa",
  // Per-client agents not part of core
  "overseer", "hermes",
];

const STRING_TOKENS = [
  // Nathan-specific paths
  "/home/nathan", ".openclaw", "legacy-workspace",
  "/root/mission-control", "~/wiki",
  "ash-image", "ash-tts", "discord-bridge",
  // Credentials
  "anthropic_api_key", "google_ads_developer_token",
];

// Whitelist: file → tokens allowed in that file (or "*" for all).
const ALLOW = new Map([
  ["scripts/check-clean-purity.mjs", "*"],
  ["CLEAN.md", "*"],
  ["lib/powered-by.ts", ["allhart"]],
  ["app/components/PoweredByFooter.tsx", ["allhart"]],
  ["README.md", ["allhart"]],
  // SPEC.md is prototype-era documentation with Nathan-specific paths.
  // Whitelisting wholesale until it gets a proper rewrite.
  ["SPEC.md", "*"],
  // tools/README.md is the mc-remote operator manual; mentioning the
  // default OBT path is fine documentation, not a hard dependency.
  ["tools/README.md", "*"],
  // user-claude.ts has dev-fallback paths and one explanatory comment
  // mentioning ANTHROPIC_API_KEY semantics. Both intentional.
  ["lib/user-claude.ts", ["/home/nathan", "anthropic_api_key"]],
  // users.ts defaults MC_ADMIN_EMAIL — the default is overridable by
  // env at install time but the literal still appears. Acceptable.
  ["lib/users.ts", ["allhart"]],
  // Inbox + agents comment-only references to "Overseer"/"Ava"/"Mia"
  // as example agent names. They're descriptions, not logic.
  ["lib/inbox.ts", ["overseer"]],
  ["lib/agents.ts", ["overseer", "~/wiki", "allhart"]],
  // The SDK doc-comment points at the spec doc location.
  ["lib/sdk/index.ts", ["~/wiki"]],
  // users.ts reserves 'overseer' as a username (along with claude/test/
  // anonymous etc.) so a client can't create a user that collides with
  // common agent identities. Generic enough to stay.
  ["lib/users.ts", ["overseer"]],
  // Install scripts intentionally probe both /home/nathan/.openclaw/...
  // and /root/mission-control/... as fallback module-resolution paths,
  // so the renderer works on either dev or VPS layout. Install-time
  // tooling, not runtime core.
  ["install/scripts/mc-element-pdf-render.cjs", "*"],
  ["install/scripts/mc-element-pptx-render.cjs", "*"],
  ["install/scripts/mc-element-xlsx-render.cjs", "*"],
  // OBT-specific runner under install/runners/obt/. The dir name is
  // historical — it's the same shape every install ends up with. Skip.
  ["install/runners/obt/mc-user-agent-runner.sh", "*"],
  // AgentsClient is the legacy multi-agent shell. Clean MC is single-agent
  // (the "me" agent); the file still carries the wider AgentName type +
  // selector UI for backward compatibility with installs that haven't
  // migrated. Untangling it without breaking the chat flow is a focused
  // session; whitelisted for now.
  ["app/agents/AgentsClient.tsx", "*"],
  // Install docs and shell scripts reference /root/mission-control (the
  // default MC_HOME) and obt.allhart.com.au (the canonical example for
  // PUBLIC_HOSTNAME). These are operator-facing examples + defaults that
  // are env-overridable. Whitelisted wholesale.
  ["install/INSTALL.md", "*"],
  ["install/mc-install.sh", "*"],
  ["install/auto-update.sh", "*"],
  ["install/mc-bind-agent.sh", "*"],
  ["install/mc-tunnel-setup.sh", "*"],
  ["install/mc-user-agent-runner.sh", "*"],
]);

// Always-skip patterns (binary, vendor, build, Tier 3 userspace,
// lockfiles whose SHA hashes randomly contain brand-substrings).
const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", "dist", "build", "out",
  "data", "config", "overrides", "secrets", "apps",
]);
const SKIP_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  "core.manifest.sha256",
]);
const SCAN_EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".sh", ".md"]);

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    if (SKIP_FILES.has(e.name)) continue;
    if (e.name.startsWith(".") && e.name !== ".gitignore") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile() && SCAN_EXTS.has(path.extname(e.name))) out.push(full);
  }
  return out;
}

function isAllowed(rel, token) {
  const allow = ALLOW.get(rel);
  if (!allow) return false;
  if (allow === "*") return true;
  return allow.includes(token.toLowerCase());
}

function listChangedFiles() {
  try {
    const base = (() => {
      try { execSync("git fetch --quiet origin main", { cwd: ROOT, stdio: "ignore" }); } catch {}
      try { return execSync("git merge-base HEAD origin/main", { cwd: ROOT, encoding: "utf8" }).trim(); }
      catch { return "HEAD~1"; }
    })();
    const raw = execSync(`git diff --name-only --diff-filter=ACMRT ${base}...HEAD`, { cwd: ROOT, encoding: "utf8" }).trim();
    return raw ? raw.split("\n") : [];
  } catch { return []; }
}

function listStagedFiles() {
  try {
    const raw = execSync("git diff --cached --name-only --diff-filter=ACMRT", { cwd: ROOT, encoding: "utf8" }).trim();
    return raw ? raw.split("\n") : [];
  } catch { return []; }
}

let files;
if (MODE === "all") {
  files = walk(ROOT);
} else {
  const changed = MODE === "staged" ? listStagedFiles() : listChangedFiles();
  files = changed
    .map((f) => path.join(ROOT, f))
    .filter((f) => {
      if (!SCAN_EXTS.has(path.extname(f))) return false;
      const rel = path.relative(ROOT, f);
      if (SKIP_FILES.has(path.basename(f))) return false;
      for (const seg of rel.split(path.sep)) if (SKIP_DIRS.has(seg)) return false;
      try { readFileSync(f); return true; } catch { return false; }
    });
  if (files.length === 0) {
    console.log(`clean-purity OK — no in-scope files changed (${MODE} mode)`);
    process.exit(0);
  }
}
const violations = [];

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const content = readFileSync(file, "utf8");
  const lower = content.toLowerCase();

  // STRING tokens — substring match
  for (const token of STRING_TOKENS) {
    if (isAllowed(rel, token)) continue;
    if (!lower.includes(token.toLowerCase())) continue;
    const lines = content.split("\n");
    const hits = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(token.toLowerCase())) {
        hits.push({ line: i + 1, text: lines[i].trim().slice(0, 120) });
      }
    }
    if (hits.length) violations.push({ file: rel, token, hits });
  }

  // WORD tokens — word-boundary regex match (case-insensitive)
  for (const token of WORD_TOKENS) {
    if (isAllowed(rel, token)) continue;
    const re = new RegExp(`\\b${token}\\b`, "i");
    if (!re.test(content)) continue;
    const lines = content.split("\n");
    const hits = [];
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        hits.push({ line: i + 1, text: lines[i].trim().slice(0, 120) });
      }
    }
    if (hits.length) violations.push({ file: rel, token, hits });
  }
}

if (violations.length === 0) {
  console.log(`clean-purity OK — ${files.length} file(s) scanned (${MODE} mode), 0 violations`);
  process.exit(0);
}

console.error(`clean-purity FAIL — ${violations.length} violation(s) across ${new Set(violations.map(v => v.file)).size} file(s) (${MODE} mode):\n`);
for (const v of violations) {
  console.error(`  ${v.file} — forbidden token: '${v.token}'`);
  for (const h of v.hits.slice(0, 3)) {
    console.error(`    L${h.line}: ${h.text}`);
  }
  if (v.hits.length > 3) console.error(`    (+${v.hits.length - 3} more)`);
}
console.error("\nSee CLEAN.md for what is and isn't allowed in this repo.");
console.error("If a token is a false positive, add a whitelist entry in scripts/check-clean-purity.mjs ALLOW map.");
process.exit(1);
