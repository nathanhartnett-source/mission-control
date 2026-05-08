"use client";

import { useCallback, useEffect, useState } from "react";

export default function WikiPathPanel() {
  const [current, setCurrent] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/install", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      const v = d?.install?.wikiRoot || "";
      setCurrent(v); setDraft(v);
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = useCallback(async () => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await fetch("/api/admin/install", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ wikiRoot: draft }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setCurrent(d?.install?.wikiRoot || draft);
      setMsg("Saved. Refresh the wiki tab to see the new files.");
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }, [draft]);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 mb-6">
      <h2 className="text-base font-semibold text-slate-100 mb-1">Wiki path</h2>
      <p className="text-xs text-slate-400 mb-4">Admin only. Where Mission Control reads markdown files from. Take effect immediately — no rebuild.</p>
      <label className="text-xs text-slate-300 block">
        Absolute path
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="/root/obt-wiki"
          className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono"
        />
      </label>
      {current && <p className="text-[11px] text-slate-500 mt-2">Currently: <code className="text-slate-300">{current}</code></p>}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={save}
          disabled={busy || !draft.trim() || draft.trim() === current}
          className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs"
        >{busy ? "Saving…" : "Save"}</button>
      </div>
      {msg && <div className="mt-3 text-xs text-emerald-400">{msg}</div>}
      {err && <div className="mt-3 text-xs text-rose-400">{err}</div>}
    </section>
  );
}
