// Instance-wide beta feature flags. Stored at $MC_DATA_ROOT/feature-flags.json.
// Admin-only toggles in /settings. Defaults below ship as the "off" baseline
// for fresh installs — anything we want hidden by default goes here.
import fs from "fs";
import path from "path";
import { mcConfig } from "@/lib/mc-config";

export type FeatureFlags = {
  buildAnApp: boolean;   // /elements/new "Build an App" (a.k.a. Build a Mini-App)
};

const DEFAULTS: FeatureFlags = {
  buildAnApp: false,
};

const FILE = path.join(mcConfig.dataRoot, "feature-flags.json");

export function readFeatureFlags(): FeatureFlags {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return { ...DEFAULTS, ...(raw && typeof raw === "object" ? raw : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeFeatureFlags(patch: Partial<FeatureFlags>): FeatureFlags {
  const current = readFeatureFlags();
  const next: FeatureFlags = { ...current, ...patch };
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(next, null, 2), "utf8");
  } catch {}
  return next;
}
