// Per-user navigation preferences.
//   pinnedOrder:  ordered slugs of built-ins shown in the sidebar (flat, no folder)
//   hiddenSystem: slugs of system built-ins (Projects/Wiki) the user has hidden
//   folders:      collapsible groups of slugs in the sidebar
//
// A slug appears in EITHER pinnedOrder OR exactly one folder.slugs — never both.
// Stored as data/nav-prefs/<userId>.json. Atomic temp+rename writes.

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";

export type NavFolder = { id: string; name: string; slugs: string[]; icon?: string };
export type NavPrefs = {
  pinnedOrder: string[];
  hiddenSystem: string[];
  folders: NavFolder[];
  purgedBuiltins: string[];
  appIcons?: Record<string, string>; // per-app icon overrides (slug → emoji/string)
};

const DATA_DIR = path.join(process.cwd(), "data", "nav-prefs");

function fileFor(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(DATA_DIR, `${safe}.json`);
}

function emptyPrefs(): NavPrefs {
  return { pinnedOrder: [], hiddenSystem: [], folders: [], purgedBuiltins: [], appIcons: {} };
}

export function getNavPrefs(userId: string): NavPrefs {
  try {
    const raw = fs.readFileSync(fileFor(userId), "utf8");
    const parsed = JSON.parse(raw) as Partial<NavPrefs> & { pinnedBuiltins?: string[] };
    // Migrate legacy pinnedBuiltins → pinnedOrder
    const pinnedOrder = Array.isArray(parsed.pinnedOrder)
      ? parsed.pinnedOrder
      : Array.isArray(parsed.pinnedBuiltins) ? parsed.pinnedBuiltins : [];
    return {
      pinnedOrder: pinnedOrder.filter((s): s is string => typeof s === "string"),
      hiddenSystem: Array.isArray(parsed.hiddenSystem) ? parsed.hiddenSystem.filter((s): s is string => typeof s === "string") : [],
      folders: Array.isArray(parsed.folders) ? parsed.folders.filter(isValidFolder) : [],
      purgedBuiltins: Array.isArray(parsed.purgedBuiltins) ? parsed.purgedBuiltins.filter((s): s is string => typeof s === "string") : [],
      appIcons: parsed.appIcons && typeof parsed.appIcons === "object" ? parsed.appIcons : {},
    };
  } catch {
    return emptyPrefs();
  }
}

function isValidFolder(f: unknown): f is NavFolder {
  if (!f || typeof f !== "object") return false;
  const x = f as Record<string, unknown>;
  return typeof x.id === "string" && typeof x.name === "string" && Array.isArray(x.slugs);
}

export async function setNavPrefs(userId: string, prefs: NavPrefs): Promise<void> {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  const target = fileFor(userId);
  const tmp = `${target}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(prefs, null, 2), "utf8");
  await fsp.rename(tmp, target);
}
