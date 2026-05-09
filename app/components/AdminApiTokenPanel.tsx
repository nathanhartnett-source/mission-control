"use client";

import { useCallback, useEffect, useState } from "react";

export default function AdminApiTokenPanel() {
  const [token, setToken] = useState<string>("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/api-token", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setToken(d?.token || "");
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const rotate = useCallback(async () => {
    if (!confirm("Rotate the admin API token? Any operator using the old token will need to update their copy.")) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await fetch("/api/admin/api-token", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "rotate" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setToken(d?.token || "");
      setShow(true);
      setMsg("Rotated. Copy the new token to anywhere it's used (e.g. ~/.mc-admin-tokens/<host>.txt).");
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }, []);

  const copy = useCallback(async () => {
    if (!token) return;
    try { await navigator.clipboard.writeText(token); setMsg("Copied to clipboard."); }
    catch { setErr("Clipboard unavailable. Select the field and copy manually."); }
  }, [token]);

  const masked = token ? token.slice(0, 4) + "…" + token.slice(-4) : "—";

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 mb-6">
      <h2 className="text-base font-semibold text-slate-100 mb-1">Admin API Token</h2>
      <p className="text-xs text-slate-400 mb-4">
        Admin only. Used by remote-ops tools (e.g. <code className="text-slate-300">mc-remote</code>) to call the
        dashboard's deploy/health endpoints without a browser session. Treat it like a password.
      </p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={show ? token : masked}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono"
        />
        <button onClick={() => setShow(s => !s)} className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200">
          {show ? "Hide" : "Show"}
        </button>
        <button onClick={copy} disabled={!token} className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200">
          Copy
        </button>
        <button onClick={rotate} disabled={busy} className="text-xs px-3 py-1.5 rounded bg-rose-700/70 hover:bg-rose-600/80 disabled:opacity-40 text-white">
          {busy ? "Rotating…" : "Rotate"}
        </button>
      </div>
      <p className="text-[11px] text-slate-500 mt-3">
        Endpoints under <code className="text-slate-300">/api/admin/api/*</code> accept this token via
        <code className="text-slate-300">Authorization: Bearer &lt;token&gt;</code>. Currently:
        <code className="text-slate-300">/api/admin/api/health</code> and
        <code className="text-slate-300">/api/admin/api/deploy</code>.
      </p>
      {msg && <div className="mt-3 text-xs text-emerald-400">{msg}</div>}
      {err && <div className="mt-3 text-xs text-rose-400">{err}</div>}
    </section>
  );
}
