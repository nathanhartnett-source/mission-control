/**
 * Next.js instrumentation hook — runs once at server boot.
 * Boots the per-minute element scheduler (Node runtime only).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/element-scheduler");
    startScheduler();
  }
}
