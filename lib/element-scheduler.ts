/**
 * Per-minute scheduler tick. Walks every saved element spec; for any whose
 * schedule.nextRunAt has passed, fires a run with the spec's preset inputs
 * and advances nextRunAt to the next slot.
 *
 * Booted from instrumentation.ts on the Node runtime side. Single setInterval
 * per process. Idempotent — uses lastRunAt to guard against double-fire if
 * the tick runs slightly fast.
 */
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import {
  listAllScheduled,
  computeNextRunAt,
  saveElement,
  newRunId,
  persistRun,
  renderPrompt,
  _runDir,
  type ElementRun,
} from "./elements";

let started = false;
let timer: NodeJS.Timeout | null = null;

const WORKER = process.env.MC_ELEMENT_WORKER || "/usr/local/bin/mc-element-worker.sh";

function fireRun(username: string, spec: import("./elements").ElementSpec): void {
  const runId = newRunId();
  const dir = _runDir(username, runId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "spec.json"), JSON.stringify(spec, null, 2), "utf8");
  const inputs: Record<string, string> = spec.schedule?.inputs || {};
  const prompt = renderPrompt(spec, inputs);

  const run: ElementRun = {
    id: runId,
    slug: spec.slug,
    username,
    inputs,
    status: "running",
    startedAt: new Date().toISOString(),
  };

  const isRoot = typeof process.getuid === "function" && process.getuid() === 0;
  const sdArgs: string[] = [];
  if (!isRoot) sdArgs.push("--user");
  sdArgs.push(
    "--quiet", "--pipe", "--collect",
    "--unit", `mc-element-${runId}.service`,
    "--description", `MC element scheduled run ${spec.slug} ${runId}`,
    "bash", WORKER, username, dir, String(spec.timeoutMin),
  );
  const child = spawn("systemd-run", sdArgs, {
    detached: true,
    stdio: ["pipe", "ignore", "ignore"],
    env: { ...process.env },
  });
  if (child.stdin) {
    child.stdin.write(prompt);
    child.stdin.end();
  }
  child.unref();
  run.pid = child.pid;
  persistRun(username, run);
}

function tick(): void {
  const now = new Date();
  for (const { username, spec } of listAllScheduled()) {
    const sched = spec.schedule;
    if (!sched) continue;
    const due = sched.nextRunAt ? new Date(sched.nextRunAt) : null;
    if (!due || due > now) continue;
    // Idempotency guard: if we already ran within the last 30s, skip.
    if (sched.lastRunAt && (now.getTime() - new Date(sched.lastRunAt).getTime()) < 30_000) continue;
    try {
      fireRun(username, spec);
      sched.lastRunAt = now.toISOString();
      sched.nextRunAt = computeNextRunAt(sched, now);
      saveElement(username, spec);
    } catch (e) {
      console.error("[element-scheduler] failed to fire", spec.slug, e);
    }
  }
}

export function startScheduler(): void {
  if (started) return;
  started = true;
  // First tick after 30s so the server has time to settle, then every 60s.
  setTimeout(() => {
    try { tick(); } catch (e) { console.error("[element-scheduler] tick error", e); }
    timer = setInterval(() => {
      try { tick(); } catch (e) { console.error("[element-scheduler] tick error", e); }
    }, 60_000);
  }, 30_000);
}

export function stopScheduler(): void {
  if (timer) { clearInterval(timer); timer = null; }
  started = false;
}
