/**
 * Next.js instrumentation hook — runs once at server boot.
 * Boots the per-minute element scheduler (Node runtime only).
 * Also verifies Tier 1 core file integrity against core.manifest.sha256.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Tier 1 integrity check — runs first so tamper alerts are visible
    // even if scheduler boot fails.
    const { verifyCoreIntegrity } = await import("./lib/core-integrity");
    verifyCoreIntegrity();

    // Scheduler boot is gated so only ONE worker per host runs the per-minute
    // tick. Set MC_SCHEDULER=off in dev / sidecar workers / CI to suppress.
    if (process.env.MC_SCHEDULER === "off") return;
    const { startScheduler } = await import("./lib/element-scheduler");
    startScheduler();
  }
}
