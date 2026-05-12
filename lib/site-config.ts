// Per-install site branding (Tier 3 userspace).
// Reads config/site.json if present, falls back to the example defaults.
// Gitignored: each install owns its own file; clean repo updates never overwrite it.

import fs from "fs";
import path from "path";

export type SiteConfig = {
  name: string;
  shortName: string;
  defaultAgentName: string;
  accentColor: string;
  logo: string | null;
  favicon: string | null;
  loginTagline: string;
};

const DEFAULTS: SiteConfig = {
  name: "Mission Control",
  shortName: "MC",
  defaultAgentName: "Your Agent",
  accentColor: "#fafafa",
  logo: null,
  favicon: null,
  loginTagline: "AI OS for your business.",
};

let cached: SiteConfig | null = null;

export function getSiteConfig(): SiteConfig {
  if (cached) return cached;
  const file = path.join(process.cwd(), "config", "site.json");
  if (!fs.existsSync(file)) {
    cached = DEFAULTS;
    return cached;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    cached = { ...DEFAULTS, ...raw };
    return cached;
  } catch {
    cached = DEFAULTS;
    return cached;
  }
}
