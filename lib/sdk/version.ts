// SDK version constants. Single source of truth = mc-version.json at repo root.

import fs from "fs";
import path from "path";

type VersionFile = { sdkVersion: number; sdkVersionLabel: string };

let cached: VersionFile | null = null;

function load(): VersionFile {
  if (cached) return cached;
  let resolved: VersionFile = { sdkVersion: 1, sdkVersionLabel: "1.0" };
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "mc-version.json"), "utf8");
    const v = JSON.parse(raw);
    resolved = {
      sdkVersion: typeof v.sdkVersion === "number" ? v.sdkVersion : 1,
      sdkVersionLabel: String(v.sdkVersionLabel || v.sdkVersion || "1"),
    };
  } catch { /* fall through to defaults */ }
  cached = resolved;
  return resolved;
}

export const SDK_VERSION = load().sdkVersion;
export const SDK_VERSION_LABEL = load().sdkVersionLabel;

/**
 * Check whether a custom app's declared minSdk is compatible with the
 * running platform SDK. Returns { ok: true } or { ok: false, reason }.
 */
export function checkMinSdk(minSdk: number | undefined): { ok: boolean; reason?: string } {
  if (minSdk === undefined || minSdk === null) return { ok: true };
  if (typeof minSdk !== "number") return { ok: false, reason: `invalid minSdk type` };
  if (minSdk <= SDK_VERSION) return { ok: true };
  return { ok: false, reason: `requires SDK >= ${minSdk}, platform is ${SDK_VERSION}` };
}
