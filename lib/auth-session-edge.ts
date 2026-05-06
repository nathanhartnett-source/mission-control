/**
 * Edge-runtime session verifier (Web Crypto only) for use in middleware.ts.
 * Mirrors lib/auth-session.ts exactly; keep them in sync.
 */
export type SessionPayload = { userId: string; exp: number };

async function hmacHex(secret: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyEdge(
  cookieValue: string | undefined,
  secret: string,
): Promise<SessionPayload | null> {
  if (!cookieValue) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  const expected = await hmacHex(secret, `${userId}.${exp}`);
  if (!constantTimeEqual(sig, expected)) return null;
  return { userId, exp };
}

export const SESSION_COOKIE = "mc_auth";
