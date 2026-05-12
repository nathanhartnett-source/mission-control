"use client";

import { useEffect, useState } from "react";

type Status = {
  sha?: string | null;
  subject?: string | null;
  date?: string | null;
  behindCount?: number;
  behindCommits?: { sha: string; subject: string }[];
};

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

// Admin-only panel that triggers the same git-pull+build+restart flow as
// `mc-remote <host> deploy`, authed by the current session cookie.
export default function UpdateFromGitHubPanel() {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const r = await fetch("/api/admin/api/deploy/status", { cache: "no-store" });
      if (r.ok) setStatus(await r.json());
    } catch { /* ignore */ }
    setLoadingStatus(false);
  };

  useEffect(() => { loadStatus(); }, []);

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
        setTimeout(loadStatus, 3000);
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setRunning(false);
    }
  };

  const upToDate = status && (status.behindCount ?? 0) === 0;
  const behindCount = status?.behindCount ?? 0;

  return (
    <section className="border border-slate-800 rounded-xl p-5 bg-slate-900/40 mt-12 mb-6">
      <h2 className="text-sm font-semibold text-slate-200">Update from GitHub</h2>
      <p className="text-xs text-slate-400 mt-1">
        Pulls the latest <code className="text-slate-300">main</code> branch from the Mission Control repo, runs <code className="text-slate-300">npm install &amp; npm run build</code>, then restarts the service.
        Active users will see a brief interruption while the restart settles.
      </p>

      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs">
        {loadingStatus ? (
          <div className="text-slate-500">Checking version…</div>
        ) : !status ? (
          <div className="text-rose-400">Couldn&rsquo;t load version info.</div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-slate-300">
                <span className="text-slate-500">Current:</span>{" "}
                <code className="text-slate-100">{status.sha || "?"}</code>
                {status.date && <span className="text-slate-500"> · {fmtDate(status.date)}</span>}
              </div>
              {upToDate ? (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300 border border-emerald-800/50">Up to date</span>
              ) : (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-200 border border-amber-800/50">{behindCount} commit{behindCount === 1 ? "" : "s"} behind</span>
              )}
            </div>
            {status.subject && (
              <div className="text-slate-400 mt-1 truncate">{status.subject}</div>
            )}
            {!upToDate && status.behindCommits && status.behindCommits.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-slate-400 hover:text-slate-200">What&rsquo;s new on origin/main</summary>
                <ul className="mt-2 space-y-1">
                  {status.behindCommits.map((c) => (
                    <li key={c.sha} className="text-slate-300">
                      <code className="text-slate-400">{c.sha}</code> {c.subject}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={run}
          disabled={running}
          className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          {running ? "Updating…" : "Update now"}
        </button>
        <button
          onClick={loadStatus}
          disabled={loadingStatus}
          className="text-xs px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
          title="Re-check version"
        >
          Refresh
        </button>
      </div>

      {err && <div className="text-xs text-rose-400 mt-3 whitespace-pre-wrap">{err}</div>}
      {log && (
        <pre className="text-[11px] text-slate-400 mt-3 bg-slate-950 border border-slate-800 rounded p-2 overflow-x-auto max-h-48">{log}</pre>
      )}
    </section>
  );
}
