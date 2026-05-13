#!/usr/bin/env node
// Generate core.manifest.sha256: sha256 hashes of every Tier 1 file.
// Run from clean repo, commit the output. Boot check (instrumentation.ts)
// verifies these hashes on startup; any mismatch surfaces an alert.
//
// Adding a file? Drop its glob below.

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { glob } from "node:fs/promises";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// Tier 1 — locked core. Patterns are root-relative.
const TIER1_DIRS = [
  "lib/sdk",
  "lib",
  "app/api/admin",
  "app/api/inbox",
  "app/api/data-alerts",
  "app/api/home-bentos",
  "app/api/auth",
  "app/api/setup",
  "app/components",
  "app/layout.tsx",
  "middleware.ts",
  "instrumentation.ts",
  "next.config.ts",
  "mc-version.json",
];

// Anything under these (relative to project root) is Tier 3 / userspace
// and is excluded even if a Tier 1 dir wraps it.
const EXCLUDE_RE = /(^|\/)(data|config|overrides|secrets|apps\/custom|node_modules|\.next|\.git)\//;

function walk(p) {
  const out = [];
  if (!existsSync(p)) return out;
  const s = statSync(p);
  if (s.isFile()) { out.push(p); return out; }
  for (const e of readdirSync(p, { withFileTypes: true })) {
    const full = path.join(p, e.name);
    if (EXCLUDE_RE.test(full + "/")) continue;
    if (e.isDirectory()) out.push(...walk(full));
    else if (e.isFile()) out.push(full);
  }
  return out;
}

const files = [];
for (const d of TIER1_DIRS) {
  for (const f of walk(path.join(ROOT, d))) {
    files.push(path.relative(ROOT, f));
  }
}
files.sort();

const manifest = {};
for (const f of files) {
  const buf = await readFile(path.join(ROOT, f));
  manifest[f] = createHash("sha256").update(buf).digest("hex");
}

const out = {
  generatedAt: new Date().toISOString(),
  fileCount: files.length,
  files: manifest,
};
await writeFile(path.join(ROOT, "core.manifest.sha256"), JSON.stringify(out, null, 2));
console.log(`wrote core.manifest.sha256 (${files.length} files)`);
