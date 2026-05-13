// Loads per-install CSS overrides from overrides/css/*.css.
// Concatenated and injected as a single <style> tag in the root layout,
// after globals.css so anything here wins. Gitignored userspace.

import fs from "fs";
import path from "path";

let cached: string | null = null;

export function readUserCssOverrides(): string {
  if (cached !== null) return cached;
  const dir = path.join(process.cwd(), "overrides", "css");
  let out = "";
  try {
    if (!fs.existsSync(dir)) {
      cached = "";
      return cached;
    }
    const files = fs.readdirSync(dir)
      .filter((f) => f.endsWith(".css"))
      .sort();
    for (const f of files) {
      try {
        out += "\n/* " + f + " */\n" + fs.readFileSync(path.join(dir, f), "utf8");
      } catch { /* skip unreadable */ }
    }
  } catch { /* skip */ }
  cached = out;
  return cached;
}
