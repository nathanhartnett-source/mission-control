// Custom-app loader (Tier 3 userspace).
//
// Scans apps/custom/<slug>/manifest.json, validates each against the
// platform SDK version, returns the list with compatibility status.
//
// Manifest shape (apps/custom/<slug>/manifest.json):
// {
//   "name": "string",
//   "slug": "string (filesystem-safe; should match dir name)",
//   "version": "string (semver, optional)",
//   "minSdk": 1,
//   "entry": "page.tsx | url-relative-path (optional)",
//   "icon": "emoji or path (optional)",
//   "description": "string (optional)"
// }

import fs from "fs";
import path from "path";
import { checkMinSdk } from "./sdk/version";

export type CustomAppManifest = {
  name: string;
  slug: string;
  version?: string;
  minSdk?: number;
  entry?: string;
  icon?: string;
  description?: string;
};

export type LoadedCustomApp = {
  manifest: CustomAppManifest;
  dir: string;
  compatible: boolean;
  reason?: string;
};

const CUSTOM_APPS_DIR = path.join(process.cwd(), "apps", "custom");

export function listCustomApps(): LoadedCustomApp[] {
  if (!fs.existsSync(CUSTOM_APPS_DIR)) return [];
  const slugs = fs.readdirSync(CUSTOM_APPS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const out: LoadedCustomApp[] = [];
  for (const slug of slugs) {
    const dir = path.join(CUSTOM_APPS_DIR, slug);
    const manifestPath = path.join(dir, "manifest.json");
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as CustomAppManifest;
      if (!m.name || !m.slug) continue;
      const sdkCheck = checkMinSdk(m.minSdk);
      out.push({
        manifest: m,
        dir,
        compatible: sdkCheck.ok,
        reason: sdkCheck.reason,
      });
    } catch {
      // malformed manifest; skip
    }
  }
  return out;
}

export function listIncompatibleCustomApps(): LoadedCustomApp[] {
  return listCustomApps().filter((a) => !a.compatible);
}
