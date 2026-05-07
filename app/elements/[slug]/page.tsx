"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type Input = { name: string; label: string; type: string; required: boolean; options?: string[]; placeholder?: string; acceptMime?: string; maxMB?: number };
type Spec = { slug: string; name: string; description: string; icon: string; inputs: Input[]; timeoutMin: number; createdBy: string };
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
