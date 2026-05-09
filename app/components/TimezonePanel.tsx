"use client";

import { useCallback, useEffect, useState } from "react";

const COMMON_TZ = [
  "UTC",
  "Australia/Brisbane",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Perth",
  "Pacific/Auckland",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Hong_Kong",
];

export default function TimezonePanel() {
  const [current, setCurrent] = useState<string>("UTC");
  const [draft, setDraft] = useState<string>("UTC");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [browserTz, setBrowserTz] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/install", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      const v = d?.install?.timezone || "UTC";
      setCurrent(v); setDraft(v);
    } catch {}
    try { setBrowserTz(Intl.DateTimeFormat().resolvedOptions().timeZone || ""); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = useCallback(async () => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await fetch("/api/admin/install", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ timezone: draft }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setCurrent(d?.install?.timezone || draft);
      setMsg("Saved. New scheduled runs will use this zone.");
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }, [draft]);

  const options = Array.from(new Set([...COMMON_TZ, browserTz, current].filter(Boolean) as string[]));

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 mb-6">
      <h2 className="text-base font-semibold text-slate-100 mb-1">Timezone</h2>
      <p className="text-xs text-slate-400 mb-4">Admin only. All scheduled apps interpret times in this zone (e.g. 9:00 AM = 9:00 in this zone).</p>
      <label className="text-xs text-slate-300 block">
        Zone
        <select
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
        >
          {options.map(tz => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      </label>
      <p className="text-[11px] text-slate-500 mt-2">
        Currently: <code className="text-slate-300">{current}</code>
        {browserTz && browserTz !== current && <> · Your browser is in <code className="text-slate-300">{browserTz}</code></>}
      </p>
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
