/**
 * Admin API token — used by `mc-remote` and similar remote-ops tools to call
 * the dashboard's admin endpoints (deploy, health, etc) without a browser
 * session. Lives in <dataRoot>/admin-api-token (mode 0600).
 *
 * On first read, generates a fresh 48-byte hex token and persists it.
 * Rotate replaces it; mc-remote callers will get 401 until the new token
 * is copied into ~/.mc-admin-tokens/<host>.txt on the operator's box.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";

const FILE = path.join(
  path.resolve(process.env.MC_DATA_ROOT || path.join(process.cwd(), "data")),
  "admin-api-token",
);

function generate(): string {
  return crypto.randomBytes(48).toString("hex");
}

export function getAdminApiToken(): string {
  try {
    const cur = fs.readFileSync(FILE, "utf8").trim();
    if (cur) return cur;
  } catch {}
  const fresh = generate();
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, fresh, { encoding: "utf8", mode: 0o600 });
  return fresh;
}

export function rotateAdminApiToken(): string {
  const fresh = generate();
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, fresh, { encoding: "utf8", mode: 0o600 });
  return fresh;
}

/** Constant-time compare to avoid timing leaks on token verification. */
export function verifyAdminApiToken(presented: string | null | undefined): boolean {
  if (!presented) return false;
  const stored = getAdminApiToken();
  const a = Buffer.from(stored);
  const b = Buffer.from(presented);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
