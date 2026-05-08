import { NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";
import { listUsers } from "@/lib/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Server-side environment probe. Tells the wizard what already exists on
// the host so it can skip steps gracefully on existing-CC servers.
export async function GET() {
  const HOME = os.homedir();
  const USER = process.env.USER || os.userInfo().username || "user";

  // Claude binary
  const claudeCandidates = [
    process.env.MC_CLAUDE_BIN || "",
    "/home/nathan/.npm-global/bin/claude",
    "/root/.npm-global/bin/claude",
    "/usr/local/bin/claude",
    "/usr/bin/claude",
    `${HOME}/.npm-global/bin/claude`,
  ].filter(Boolean);
  let claudeBin: string | null = null;
  for (const c of claudeCandidates) if (fs.existsSync(c)) { claudeBin = c; break; }
  if (!claudeBin) {
    try {
      const out = execSync("which claude", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
      if (out) claudeBin = out;
    } catch {}
  }
  let claudeVersion: string | null = null;
  if (claudeBin) {
    try {
      claudeVersion = execSync(`${claudeBin} --version`, { stdio: ["ignore", "pipe", "ignore"], timeout: 4000 }).toString().trim();
    } catch {}
  }

  // Wiki
  const wikiPath = path.join(HOME, "wiki");
  const wikiExists = fs.existsSync(wikiPath);
  let wikiFileCount = 0;
  if (wikiExists) {
    try {
      const walk = (dir: string, depth = 0): number => {
        if (depth > 3) return 0;
        let n = 0;
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          if (ent.name.startsWith(".") || ent.name === "node_modules" || ent.name === "_outbox" || ent.name === "_inbox") continue;
          const p = path.join(dir, ent.name);
          if (ent.isDirectory()) n += walk(p, depth + 1);
          else if (ent.name.endsWith(".md")) n++;
        }
        return n;
      };
      wikiFileCount = walk(wikiPath);
    } catch {}
  }

  // CC memory dirs
  const projectsRoot = path.join(HOME, ".claude", "projects");
  const memoryDirs: { dir: string; fileCount: number; hasPersona: boolean }[] = [];
  if (fs.existsSync(projectsRoot)) {
    try {
      for (const ent of fs.readdirSync(projectsRoot, { withFileTypes: true })) {
        if (!ent.isDirectory()) continue;
        const memDir = path.join(projectsRoot, ent.name, "memory");
        if (!fs.existsSync(memDir)) continue;
        let count = 0;
        let hasPersona = false;
        try {
          for (const f of fs.readdirSync(memDir)) {
            if (f.endsWith(".md")) count++;
            if (f === "persona.md") hasPersona = true;
          }
        } catch {}
        memoryDirs.push({ dir: memDir, fileCount: count, hasPersona });
      }
    } catch {}
  }

  // Default user-level instructions
  const claudeMd = path.join(HOME, ".claude", "CLAUDE.md");
  const userClaudeMdExists = fs.existsSync(claudeMd);

  // Whether MC has been set up before
  const hasAdmin = listUsers().some((u) => u.isAdmin && u.status === "active");

  return NextResponse.json({
    ok: true,
    home: HOME,
    user: USER,
    claude: { found: !!claudeBin, path: claudeBin, version: claudeVersion },
    wiki: { path: wikiPath, exists: wikiExists, fileCount: wikiFileCount },
    memoryDirs,
    userClaudeMd: { path: claudeMd, exists: userClaudeMdExists },
    hasAdmin,
  });
}
