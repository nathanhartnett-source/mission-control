// Per-user navigation preferences.
//   pinnedBuiltins: slugs of "app"-kind built-ins shown in the sidebar
//   hiddenSystem:   slugs of "system"-kind built-ins the user has hidden from the sidebar
//
// Stored as data/nav-prefs/<userId>.json. Atomic temp+rename writes.

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";

export type NavPrefs = {
  pinnedBuiltins: string[];
  hiddenSystem: string[];
};

const DATA_DIR = path.join(process.cwd(), "data", "nav-prefs");

function fileFor(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(DATA_DIR, `${safe}.json`);
}

export function getNavPrefs(userId: string): NavPrefs {
  try {
    const raw = fs.readFileSync(fileFor(userId), "utf8");
    const parsed = JSON.parse(raw);
    return {
      pinnedBuiltins: Array.isArray(parsed.pinnedBuiltins) ? parsed.pinnedBuiltins : [],
      hiddenSystem: Array.isArray(parsed.hiddenSystem) ? parsed.hiddenSystem : [],
    };
  } catch {
    return { pinnedBuiltins: [], hiddenSystem: [] };
  }
}

export async function setNavPrefs(userId: string, prefs: NavPrefs): Promise<void> {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  const target = fileFor(userId);
  const tmp = `${target}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(prefs, null, 2), "utf8");
  await fsp.rename(tmp, target);
}
