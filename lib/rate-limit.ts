/**
 * Tiny in-memory token bucket. Fine for single-instance MC; replace with
 * a shared store if MC ever runs multi-process.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function checkLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { ok: true, remaining: limit - b.count, retryAfterSec: 0 };
}

export function clientIp(req: { headers: Headers }): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
