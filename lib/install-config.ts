import fs from "fs";
import path from "path";

// Persisted install-time choices (paths the operator picked during /setup).
// Lives at <dataRoot>/install.json so it survives upgrades, separate from
// branding.json. Read by mc-config to override defaults.

const FILE = path.join(
  path.resolve(process.env.MC_DATA_ROOT || path.join(process.cwd(), "data")),
  "install.json",
);

export type InstallConfig = {
  wikiRoot?: string | null;
};

export function readInstallConfig(): InstallConfig {
  try {
    const raw = fs.readFileSync(FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as InstallConfig;
  } catch {}
  return {};
}

export function writeInstallConfig(patch: Partial<InstallConfig>): InstallConfig {
  const cur = readInstallConfig();
  const next: InstallConfig = { ...cur, ...patch };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2), "utf-8");
  return next;
}
