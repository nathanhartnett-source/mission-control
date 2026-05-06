/**
 * Signed session cookie carrying the user_id. Format:
 *   <userId>.<expEpochSec>.<hex_hmac_sha256>
 * HMAC is over `${userId}.${exp}` keyed by MC_COOKIE_SECRET.
 *
 * Two impls:
 *  - Node:  sign / verify (used in API routes — bcrypt route can't be Edge anyway)
 *  - Edge:  verifyEdge    (used in middleware, Web Crypto only)
 */
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "mc_auth";
const TTL_SEC = 30 * 24 * 60 * 60;

export type SessionPayload = { userId: string; exp: number };

function getSecret(): string {
  const s = process.env.MC_COOKIE_SECRET;
  if (!s) throw new Error("MC_COOKIE_SECRET not set");
  return s;
}

export function sign(userId: string): { value: string; maxAge: number } {
  const exp = Math.floor(Date.now() / 1000) + TTL_SEC;
  const payload = `${userId}.${exp}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return { value: `${payload}.${sig}`, maxAge: TTL_SEC };
}

export function verify(cookieValue: string | undefined): SessionPayload | null {
  if (!cookieValue) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  const expected = createHmac("sha256", getSecret()).update(`${userId}.${exp}`).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return { userId, exp };
}

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_TTL_SEC = TTL_SEC;
