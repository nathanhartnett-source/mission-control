import fs from "fs";
import path from "path";
import WikiClient, { WikiEntry } from "./WikiClient";

export const metadata = { title: "Wiki — Allhart MC" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WIKI_ROOT =
  process.env.MC_WIKI_ROOT ||
  (process.env.MC_HOME ? path.join(process.env.MC_HOME, "wiki") : "/home/nathan/wiki");

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

function readEntries(): WikiEntry[] {
  if (!fs.existsSync(WIKI_ROOT)) return [];
  const catalogPath = path.join(WIKI_ROOT, ".entries.json");
  let rawEntries: EntryJson[] = [];

  if (fs.existsSync(catalogPath)) {
    const parsed = JSON.parse(fs.readFileSync(catalogPath, "utf-8")) as { entries?: EntryJson[] };
    rawEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
  } else {
    rawEntries = fs
      .readdirSync(WIKI_ROOT, { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith(".md"))
      .map((d) => ({ path: path.relative(WIKI_ROOT, path.join(d.parentPath, d.name)) }));
  }

  const bySlug = new Map<string, string>();
  for (const entry of rawEntries) {
    bySlug.set(slugFor(entry.path), entry.path);
  }

  return rawEntries
    .filter((entry) => entry.path.endsWith(".md"))
    .map((entry) => {
      const abs = path.join(WIKI_ROOT, entry.path);
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

export default function WikiPage() {
  return <WikiClient entries={readEntries()} />;
}
