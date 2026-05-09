"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type Input = { name: string; label: string; type: string; required: boolean; options?: string[]; placeholder?: string; acceptMime?: string; maxMB?: number };
type ScheduleCfg = { freq: "daily"|"weekly"|"monthly"; time: string; dayOfWeek?: number; dayOfMonth?: number; inputs: Record<string,string>; nextRunAt?: string; lastRunAt?: string };
type Spec = { slug: string; name: string; description: string; icon: string; inputs: Input[]; timeoutMin: number; createdBy: string; shareWithOrg?: boolean; schedule?: ScheduleCfg };
type Run = { id: string; status: string; startedAt: string; endedAt?: string };

export default function ElementPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [spec, setSpec] = useState<Spec | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [me, setMe] = useState("");
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setMe((d?.user?.username || "").toLowerCase())).catch(() => {});
    fetch(`/api/elements/${slug}`).then(r => r.json()).then(d => setSpec(d.spec));
    fetch(`/api/elements/pinned`).then(r => r.json()).then(d => setPinned((d.pinned || []).some((p: { slug: string }) => p.slug === slug))).catch(() => {});
    refreshRuns();
    const t = setInterval(refreshRuns, 5000);
    return () => clearInterval(t);
  }, [slug]);

  function refreshRuns() {
    fetch(`/api/elements/${slug}/run`).then(r => r.json()).then(d => setRuns(d.runs || []));
  }

  async function uploadFile(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("files", file);
    const r = await fetch("/api/agents/upload", { method: "POST", body: fd });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "upload failed");
    return d.files[0].path as string;
  }

  async function run() {
    setBusy(true); setError("");
    try {
      // Resolve any pending File values to staged paths
      const resolved: Record<string, string> = { ...values };
      for (const inp of spec?.inputs || []) {
        if (inp.type === "file" && resolved[inp.name] === "__pending__") {
          const f = (window as any).__elementFiles?.[inp.name] as File | undefined;
          if (f) resolved[inp.name] = await uploadFile(f);
          else if (inp.required) throw new Error(`missing file: ${inp.label}`);
          else resolved[inp.name] = "";
        }
      }
      const r = await fetch(`/api/elements/${slug}/run`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ inputs: resolved }) });
      const data = await r.json();
      if (!r.ok) { setError(data.error); return; }
      router.push(`/elements/${slug}/runs/${data.runId}`);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  function setFile(name: string, file: File | null) {
    const w = window as any;
    w.__elementFiles = w.__elementFiles || {};
    if (file) { w.__elementFiles[name] = file; setValues({ ...values, [name]: "__pending__" }); }
    else { delete w.__elementFiles[name]; setValues({ ...values, [name]: "" }); }
  }

  async function del() {
    if (!confirm("Delete this element? Runs history will be kept.")) return;
    await fetch(`/api/elements/${slug}`, { method: "DELETE" });
    router.push("/elements");
  }

  async function rename() {
    const next = prompt("New name for this app:", spec?.name || "");
    if (!next || !next.trim() || next.trim() === spec?.name) return;
    const r = await fetch(`/api/elements/${slug}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: next.trim() }) });
    const d = await r.json();
    if (!r.ok) { alert(d.error || "rename failed"); return; }
    setSpec(s => s ? { ...s, name: d.name } : s);
  }

  async function togglePin() {
    const next = !pinned;
    const r = await fetch(`/api/elements/${slug}/pin`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pinned: next }) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "pin failed"); return; }
    setPinned(next);
  }

  if (!spec) return <main className="max-w-3xl mx-auto px-6 py-10 text-slate-500">Loading…</main>;

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 text-slate-200">
      <Link href="/elements" className="text-xs text-slate-500 hover:text-slate-300">← All apps</Link>
      <div className="flex items-start justify-between mt-2 mb-6">
        <div className="flex items-start gap-4">
          <div className="text-5xl">{spec.icon}</div>
          <div>
            <h1 className="text-2xl font-semibold">{spec.name}</h1>
            <p className="text-sm text-slate-400 mt-1">{spec.description}</p>
            <p className="text-[10px] text-slate-600 mt-1">by {spec.createdBy} · ~{spec.timeoutMin} min runs</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={togglePin} title={pinned ? "Remove from sidebar" : "Pin to sidebar"} className={`text-xs font-medium ${pinned ? "text-amber-300 hover:text-amber-200" : "text-slate-400 hover:text-slate-200"}`}>
            {pinned ? "📌 Pinned" : "Pin"}
          </button>
          {spec.createdBy === me && (
            <>
              <button
                onClick={async () => {
                  const next = !spec.shareWithOrg;
                  const r = await fetch(`/api/elements/${slug}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ shareWithOrg: next }) });
                  if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "share toggle failed"); return; }
                  setSpec(s => s ? { ...s, shareWithOrg: next } : s);
                }}
                title={spec.shareWithOrg ? "Currently shared with org — click to make private" : "Currently private — click to share with org"}
                className={`text-xs font-medium ${spec.shareWithOrg ? "text-emerald-300 hover:text-emerald-200" : "text-slate-400 hover:text-slate-200"}`}
              >
                {spec.shareWithOrg ? "👥 Shared" : "Share"}
              </button>
              <Link href={`/elements/new?slug=${slug}`} className="text-xs text-indigo-400 hover:text-indigo-300">Edit</Link>
              <button onClick={rename} className="text-xs text-slate-400 hover:text-slate-200">Rename</button>
              <button onClick={del} className="text-xs text-red-400 hover:text-red-300">Delete</button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-3 border border-slate-800 rounded-xl p-5 bg-slate-900/40">
        {spec.inputs.map(inp => (
          <div key={inp.name}>
            <label className="text-xs font-medium text-slate-400 block mb-1">{inp.label}{inp.required && <span className="text-red-400"> *</span>}</label>
            {inp.type === "textarea" ? (
              <textarea value={values[inp.name] || ""} onChange={e => setValues({ ...values, [inp.name]: e.target.value })} placeholder={inp.placeholder} className="w-full h-24 px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm" />
            ) : inp.type === "file" ? (
              <input
                type="file"
                accept={inp.acceptMime}
                onChange={e => setFile(inp.name, e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-300 file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200 file:text-xs"
              />
            ) : inp.type === "select" ? (
              <select value={values[inp.name] || ""} onChange={e => setValues({ ...values, [inp.name]: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm">
                <option value="">— choose —</option>
                {(inp.options || []).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input type={inp.type === "number" ? "number" : "text"} value={values[inp.name] || ""} onChange={e => setValues({ ...values, [inp.name]: e.target.value })} placeholder={inp.placeholder} className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm" />
            )}
          </div>
        ))}
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <button onClick={run} disabled={busy} className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white text-sm font-medium">
          {busy ? "Starting…" : "Run"}
        </button>
      </div>

      {spec.createdBy === me && <SchedulePanel spec={spec} onChange={s => setSpec(prev => prev ? { ...prev, schedule: s } : prev)} />}

      <h2 className="text-sm font-semibold text-slate-300 mt-8 mb-2">Runs</h2>
      {runs.length === 0 ? <div className="text-xs text-slate-500">No runs yet.</div> : (
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          {runs.map(r => (
            <Link key={r.id} href={`/elements/${slug}/runs/${r.id}`} className="flex items-center justify-between px-4 py-3 border-b border-slate-800 last:border-0 hover:bg-slate-900">
              <div className="text-xs text-slate-400">{new Date(r.startedAt).toLocaleString()}</div>
              <span className={`text-[10px] px-2 py-0.5 rounded ${
                r.status === "done" ? "bg-emerald-900/40 text-emerald-300" :
                r.status === "running" ? "bg-amber-900/40 text-amber-300 animate-pulse" :
                "bg-red-900/40 text-red-300"
              }`}>{r.status}</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function SchedulePanel({ spec, onChange }: { spec: Spec; onChange: (s: ScheduleCfg | undefined) => void }) {
  const [open, setOpen] = useState(!!spec.schedule);
  const [freq, setFreq] = useState<ScheduleCfg["freq"]>(spec.schedule?.freq || "daily");
  const [time, setTime] = useState(spec.schedule?.time || "09:00");
  const [dayOfWeek, setDayOfWeek] = useState(spec.schedule?.dayOfWeek ?? 1);
  const [dayOfMonth, setDayOfMonth] = useState(spec.schedule?.dayOfMonth ?? 1);
  const [inputs, setInputs] = useState<Record<string,string>>(spec.schedule?.inputs || {});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [tz, setTz] = useState("UTC");
  useEffect(() => { fetch("/api/timezone").then(r => r.json()).then(d => d?.timezone && setTz(d.timezone)).catch(() => {}); }, []);

  async function save() {
    setBusy(true); setErr("");
    try {
      const body: Record<string, unknown> = { freq, time, inputs };
      if (freq === "weekly") body.dayOfWeek = dayOfWeek;
      if (freq === "monthly") body.dayOfMonth = dayOfMonth;
      const r = await fetch(`/api/elements/${spec.slug}/schedule`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "save failed"); return; }
      onChange(d.schedule);
    } finally { setBusy(false); }
  }
  async function clearSchedule() {
    if (!confirm("Stop running this app on a schedule?")) return;
    setBusy(true);
    try {
      await fetch(`/api/elements/${spec.slug}/schedule`, { method: "DELETE" });
      onChange(undefined);
      setOpen(false);
    } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <div className="mt-6">
        <button onClick={() => setOpen(true)} className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200">
          ⏰ Run on a schedule
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 border border-slate-800 rounded-xl p-4 bg-slate-900/40 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">⏰ Schedule</h3>
        <span className="text-[10px] text-slate-500">
          {spec.schedule?.nextRunAt ? <>Next run: {new Date(spec.schedule.nextRunAt).toLocaleString(undefined, { timeZone: tz })} · </> : null}
          Times in <code className="text-slate-400">{tz}</code>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">How often</label>
          <select value={freq} onChange={e => setFreq(e.target.value as ScheduleCfg["freq"])} className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm">
            <option value="daily">Every day</option>
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">At what time</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm" />
        </div>
        {freq === "weekly" && (
          <div className="col-span-2">
            <label className="text-xs text-slate-400 block mb-1">Day of week</label>
            <select value={dayOfWeek} onChange={e => setDayOfWeek(parseInt(e.target.value, 10))} className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm">
              {DOW.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
        )}
        {freq === "monthly" && (
          <div className="col-span-2">
            <label className="text-xs text-slate-400 block mb-1">Day of month (1–28)</label>
            <input type="number" min={1} max={28} value={dayOfMonth} onChange={e => setDayOfMonth(Math.min(28, Math.max(1, parseInt(e.target.value, 10) || 1)))} className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm" />
          </div>
        )}
      </div>
      {spec.inputs.length > 0 && (
        <div>
          <label className="text-xs text-slate-400 block mb-1">Use these answers each time</label>
          <div className="space-y-2">
            {spec.inputs.map(inp => (
              <div key={inp.name}>
                <div className="text-[10px] text-slate-500 mb-0.5">{inp.label}</div>
                {inp.type === "select" ? (
                  <select value={inputs[inp.name] || ""} onChange={e => setInputs({ ...inputs, [inp.name]: e.target.value })} className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs">
                    <option value="">— choose —</option>
                    {(inp.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : inp.type === "file" ? (
                  <div className="text-[10px] text-slate-500 italic">File inputs not supported in scheduled runs yet — leave blank</div>
                ) : (
                  <input value={inputs[inp.name] || ""} onChange={e => setInputs({ ...inputs, [inp.name]: e.target.value })} placeholder={inp.placeholder} className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {err && <div className="text-red-400 text-xs">{err}</div>}
      <div className="flex items-center gap-2">
        <button onClick={save} disabled={busy} className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white">
          {busy ? "Saving…" : (spec.schedule ? "Update schedule" : "Save schedule")}
        </button>
        {spec.schedule && <button onClick={clearSchedule} disabled={busy} className="text-xs text-red-400 hover:text-red-300">Stop scheduling</button>}
        <button onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-slate-300 ml-auto">Hide</button>
      </div>
    </div>
  );
}
