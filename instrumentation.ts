/**
 * Next.js instrumentation hook — runs once at server boot.
 * Boots the per-minute element scheduler (Node runtime only).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Scheduler boot is gated so only ONE worker per host runs the per-minute
    // tick. Set MC_SCHEDULER=off in dev / sidecar workers / CI to suppress.
    if (process.env.MC_SCHEDULER === "off") return;
    const { startScheduler } = await import("./lib/element-scheduler");
    startScheduler();
  }
}
