import fs from "fs";
import path from "path";
import { cookies } from "next/headers";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import WikiClient, { WikiEntry } from "./WikiClient";

export const metadata = { title: "Wiki — Allhart AIOS" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { mcConfig } from "@/lib/mc-config";

// Resolve per-invocation via mcConfig getter so install.json-picked path
// applies without a server restart. Don't cache in a module-level const.
function wikiRoot() { return mcConfig.wikiRoot; }

/**
 * Per-user session scoping. Sessions live at sessions/<username>/*.md.
 * Each user only sees their own session logs; admins see all. Concepts,
 * decisions, references etc. stay shared at the wiki root.
 */
async function getActiveUser(): Promise<{ username: string; isAdmin: boolean } | null> {
  try {
    const c = await cookies();
    const session = verify(c.get(SESSION_COOKIE)?.value);
    if (!session) return null;
    const user = findById(session.userId);
    if (!user || user.status !== "active") return null;
    return { username: user.username.toLowerCase(), isAdmin: !!user.isAdmin };
  } catch { return null; }
}

function isOtherUserSession(entryPath: string, viewer: { username: string; isAdmin: boolean } | null): boolean {
  if (!entryPath.startsWith("sessions/")) return false;
  if (viewer?.isAdmin) return false;
  const parts = entryPath.split("/");
  // Top-level sessions/*.md is legacy unscoped — hide from non-admins.
  if (parts.length === 2) return true;
  if (parts.length >= 3) {
    const owner = parts[1].toLowerCase();
    if (!viewer || owner !== viewer.username) return true;
  }
  return false;
}

type EntryJson = {
  path: string;
  title?: string;
  type?: string;
  tags?: string[];
  updated?: string;
  summary?: string;
  lines?: number;
};

function titleFromPath(filePath: string) {
  const base = path.basename(filePath, path.extname(filePath));
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugFor(entryPath: string) {
  return path.basename(entryPath, path.extname(entryPath));
}

function readEntries(viewer: { username: string; isAdmin: boolean } | null): WikiEntry[] {
  const catalogPath = path.join(wikiRoot(), ".entries.json");
  let rawEntries: EntryJson[] = [];

  if (fs.existsSync(catalogPath)) {
    const parsed = JSON.parse(fs.readFileSync(catalogPath, "utf-8")) as { entries?: EntryJson[] };
    rawEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
  } else {
    rawEntries = fs
      .readdirSync(wikiRoot(), { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith(".md"))
      .map((d) => ({ path: path.relative(wikiRoot(), path.join(d.parentPath, d.name)) }));
  }

  const bySlug = new Map<string, string>();
  for (const entry of rawEntries) {
    bySlug.set(slugFor(entry.path), entry.path);
  }

  return rawEntries
    .filter((entry) => entry.path.endsWith(".md"))
    .filter((entry) => !isOtherUserSession(entry.path, viewer))
    .map((entry) => {
      const abs = path.join(wikiRoot(), entry.path);
      let outbound: string[] = [];
      if (fs.existsSync(abs)) {
        const text = fs.readFileSync(abs, "utf-8");
        const matches = [...text.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)];
        outbound = Array.from(
          new Set(
            matches
              .map((m) => m[1].trim().replace(/\.md$/, ""))
              .map((slug) => bySlug.get(slug) || bySlug.get(path.basename(slug)) || `${slug}.md`)
              .filter((target) => target !== entry.path),
          ),
        ).slice(0, 24);
      }

      return {
        path: entry.path,
        slug: slugFor(entry.path),
        title: entry.title || titleFromPath(entry.path),
        type: entry.type || entry.path.split("/")[0] || "wiki",
        tags: Array.isArray(entry.tags) ? entry.tags : [],
        updated: entry.updated || "",
        summary: entry.summary || "",
        lines: entry.lines || 0,
        links: outbound,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

export default async function WikiPage() {
  const viewer = await getActiveUser();
  return <WikiClient entries={readEntries(viewer)} />;
}
