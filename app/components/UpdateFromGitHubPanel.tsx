"use client";

import { useState } from "react";

// Admin-only panel that triggers the same git-pull+build+restart flow as
// `mc-remote <host> deploy`, authed by the current session cookie.
export default function UpdateFromGitHubPanel() {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    if (running) return;
    if (!confirm("Pull latest from GitHub, rebuild, and restart Mission Control? This will briefly interrupt active sessions while the service restarts (~30–60s).")) return;
    setRunning(true);
    setErr(null);
    setLog("Starting…");
    try {
      const r = await fetch("/api/admin/api/deploy", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d?.error || `HTTP ${r.status}`);
      } else {
        setLog(d?.stdout || "Done — restart queued.");
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
      <h2 className="text-sm font-semibold text-slate-200">Update from GitHub</h2>
      <p className="text-xs text-slate-400 mt-1">
        Pulls the latest <code className="text-slate-300">main</code> branch from the Mission Control repo, runs <code className="text-slate-300">npm install &amp; npm run build</code>, then restarts the service.
        Active users will see a brief interruption while the restart settles.
      </p>
      <div className="mt-3">
        <button
          onClick={run}
          disabled={running}
          className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          {running ? "Updating…" : "Update now"}
        </button>
      </div>
      {err && <div className="text-xs text-rose-400 mt-3 whitespace-pre-wrap">{err}</div>}
      {log && (
        <pre className="text-[11px] text-slate-400 mt-3 bg-slate-950 border border-slate-800 rounded p-2 overflow-x-auto max-h-48">{log}</pre>
      )}
    </section>
  );
}
