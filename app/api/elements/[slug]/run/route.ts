import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import os from "os";
import fs from "fs";
import { requireUser } from "@/lib/elements-auth";
import { getElement, listRuns, newRunId, persistRun, renderPrompt, _runDir, type ElementRun } from "@/lib/elements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function findWorker(): string {
  const candidates = [
    process.env.MC_ELEMENT_WORKER,
    path.join(os.homedir(), "bin", "mc-element-worker.sh"),
    "/usr/local/bin/mc-element-worker.sh",
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  return candidates[1];
}
const WORKER = findWorker();

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await ctx.params;
  const spec = getElement(auth.username, slug);
  if (!spec) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const inputs: Record<string, string> = body?.inputs || {};

  // Validate required inputs
  for (const inp of spec.inputs) {
    if (inp.required && !(inputs[inp.name] || "").toString().trim()) {
      return NextResponse.json({ error: `missing required input: ${inp.label}` }, { status: 400 });
    }
  }

  const runId = newRunId();
  const dir = _runDir(auth.username, runId);
  fs.mkdirSync(dir, { recursive: true });

  // Snapshot spec for the worker (PDF renderer needs letterhead path + outputFormat).
  fs.writeFileSync(path.join(dir, "spec.json"), JSON.stringify(spec, null, 2), "utf8");

  const prompt = renderPrompt(spec, inputs);

  const run: ElementRun = {
    id: runId,
    slug,
    username: auth.username,
    inputs,
    status: "running",
    startedAt: new Date().toISOString(),
  };

  // Spawn worker as a systemd TRANSIENT SERVICE (not a scope). A scope ties
  // its lifetime to the invoking PID; a transient service is fully detached.
  // This makes the worker survive MC restarts — mc-build-watcher.service
  // bounces mission-control.service on every .next change, and systemd's
  // default KillMode=control-group nukes all descendants of the unit
  // (including detached + unref'd children). Putting the worker in its own
  // transient .service unit moves it out of MC's cgroup entirely.
  // 2026-05-07: deep-research run mouxt7ia-f7314e8e was killed mid-run this
  // way (started 13:39:21, MC restarted 13:41:13, worker SIGKILL'd at 13:42:44).
  // Worker stdin is the rendered prompt — pipe it in via --pipe.
  // systemd-run --user requires a user systemd instance, which root usually
  // lacks unless `loginctl enable-linger` is set up. When MC runs as root
  // (single-tenant installs like OBT), use system-mode systemd-run.
  const isRoot = typeof process.getuid === "function" && process.getuid() === 0;
  const sdArgs: string[] = [];
  if (!isRoot) sdArgs.push("--user");
  sdArgs.push(
    "--quiet",
    "--pipe",
    "--collect",
    "--unit", `mc-element-${runId}.service`,
    "--description", `MC element worker ${slug} run ${runId}`,
    "bash", WORKER, auth.username, dir, String(spec.timeoutMin),
  );
  const child = spawn("systemd-run", sdArgs, {
    detached: true,
    stdio: ["pipe", "ignore", "ignore"],
    env: { ...process.env },
  });
  child.stdin.write(prompt);
  child.stdin.end();
  child.unref();

  run.pid = child.pid;
  persistRun(auth.username, run);

  return NextResponse.json({ ok: true, runId });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await ctx.params;
  return NextResponse.json({ runs: listRuns(auth.username, slug) });
}
