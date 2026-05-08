"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Input = { name: string; label: string; type: "text"|"textarea"|"select"|"number"|"file"; required: boolean; placeholder?: string; options?: string[]; acceptMime?: string; maxMB?: number };
type Letterhead = { mode: "none" | "upload"; stagedPath?: string; imagePath?: string; previewUrl?: string };
type Spec = {
  slug: string; name: string; description: string; icon: string;
  inputs: Input[]; promptTemplate: string; timeoutMin: number; shareWithOrg: boolean;
  outputFormat: "markdown" | "pdf" | "xlsx" | "pptx";
  letterhead: Letterhead;
};

export default function NewElement() {
  const router = useRouter();
  const search = useSearchParams();
  const editSlug = search?.get("slug") || "";
  const isEdit = !!editSlug;
  const [phase, setPhase] = useState<"describe"|"review">(isEdit ? "review" : "describe");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsMoreInfo, setNeedsMoreInfo] = useState("");
  const [spec, setSpec] = useState<Spec | null>(null);

  // Edit mode: load the existing spec.
  useEffect(() => {
    if (!isEdit) return;
    fetch(`/api/elements/${editSlug}`).then(r => r.json()).then(d => {
      if (d.spec) setSpec({ shareWithOrg: false, timeoutMin: 10, outputFormat: "markdown", letterhead: { mode: "none" }, ...d.spec });
      else setError(d.error || "Could not load app");
    });
  }, [isEdit, editSlug]);

  async function generate() {
    setBusy(true); setError(""); setNeedsMoreInfo("");
    try {
      const r = await fetch("/api/elements/builder", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ description }) });
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Build failed"); return; }
      if (data.needsMoreInfo) { setNeedsMoreInfo(data.needsMoreInfo); return; }
      setSpec({ shareWithOrg: false, timeoutMin: 10, outputFormat: "markdown", letterhead: { mode: "none" }, ...data.spec });
      setPhase("review");
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!spec) return;
    setBusy(true); setError("");
    try {
      const url = isEdit ? `/api/elements/${editSlug}` : "/api/elements";
      const method = isEdit ? "PUT" : "POST";
      const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(spec) });
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Save failed"); return; }
      router.push(`/elements/${data.spec.slug}`);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  function updateSpec<K extends keyof Spec>(k: K, v: Spec[K]) { if (spec) setSpec({ ...spec, [k]: v }); }
  function updateInput(i: number, patch: Partial<Input>) {
    if (!spec) return;
    const inputs = [...spec.inputs]; inputs[i] = { ...inputs[i], ...patch };
    setSpec({ ...spec, inputs });
  }
  function removeInput(i: number) { if (!spec) return; const inputs = spec.inputs.filter((_, j) => j !== i); setSpec({ ...spec, inputs }); }
  function addInput() {
    if (!spec) return;
    setSpec({ ...spec, inputs: [...spec.inputs, { name: `field_${spec.inputs.length + 1}`, label: "New field", type: "text", required: false }] });
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 text-slate-200">
      <h1 className="text-2xl font-semibold mb-2">Build an Element</h1>
      <p className="text-sm text-slate-400 mb-6">Describe what you want — your agent will draft a spec. You review and tweak before saving.</p>

      {phase === "describe" && (
        <div className="space-y-4">
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder='e.g. "Weekly stock-low report — pulls Woo stock data across our 5 sites, outputs a PDF with charts of low SKUs by site." Or: "New product PDP draft — I enter product name + material + price, get back Tessa-voice copy and an image brief."'
            className="w-full h-48 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-sm focus:border-indigo-500 focus:outline-none"
          />
          {needsMoreInfo && <div className="text-amber-400 text-sm bg-amber-950/30 border border-amber-900/50 rounded-lg p-3"><strong>Need more info:</strong> {needsMoreInfo}</div>}
          {error && <div className="text-red-400 text-sm">{error}</div>}
          <button onClick={generate} disabled={busy || !description.trim()} className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium">
            {busy ? "Drafting…" : "Draft spec"}
          </button>
        </div>
      )}

      {phase === "review" && spec && (
        <div className="space-y-5">
          <div className="grid grid-cols-[60px_1fr] gap-3">
            <input value={spec.icon} onChange={e => updateSpec("icon", e.target.value)} maxLength={4} className="text-3xl text-center bg-slate-900 border border-slate-700 rounded-lg" />
            <input value={spec.name} onChange={e => updateSpec("name", e.target.value)} className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-base font-semibold" />
          </div>
          <textarea value={spec.description} onChange={e => updateSpec("description", e.target.value)} placeholder="Description" className="w-full h-16 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm" />

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-300">Inputs</h3>
              <button onClick={addInput} className="text-xs text-indigo-400 hover:text-indigo-300">+ Add input</button>
            </div>
            <div className="space-y-2">
              {spec.inputs.map((inp, i) => (
                <div key={i} className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
                  <div className="grid grid-cols-2 gap-2">
                    <input value={inp.label} onChange={e => updateInput(i, { label: e.target.value })} placeholder="Label" className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm" />
                    <input value={inp.name} onChange={e => updateInput(i, { name: e.target.value.replace(/[^a-z0-9_]/g,"_") })} placeholder="field_name" className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm font-mono" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <select value={inp.type} onChange={e => updateInput(i, { type: e.target.value as any })} className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm">
                      <option value="text">text</option>
                      <option value="textarea">textarea</option>
                      <option value="select">select</option>
                      <option value="number">number</option>
                      <option value="file">file</option>
                    </select>
                    <label className="flex items-center gap-2 text-xs text-slate-400">
                      <input type="checkbox" checked={inp.required} onChange={e => updateInput(i, { required: e.target.checked })} /> required
                    </label>
                    <button onClick={() => removeInput(i)} className="text-xs text-red-400 hover:text-red-300">remove</button>
                  </div>
                  {inp.type === "select" && (
                    <input value={(inp.options || []).join(", ")} onChange={e => updateInput(i, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} placeholder="option1, option2, option3" className="w-full mt-2 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm" />
                  )}
                  {inp.type === "file" && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <input value={inp.acceptMime || ""} onChange={e => updateInput(i, { acceptMime: e.target.value })} placeholder="accept (e.g. image/*,application/pdf)" className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm" />
                      <input type="number" min={1} max={50} value={inp.maxMB || 20} onChange={e => updateInput(i, { maxMB: +e.target.value || 20 })} placeholder="max MB" className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-300 block mb-1">Prompt template</label>
            <p className="text-xs text-slate-500 mb-2">What the AI worker will be told. Use <code className="text-indigo-400">{"{{field_name}}"}</code> to inject inputs.</p>
            <textarea value={spec.promptTemplate} onChange={e => updateSpec("promptTemplate", e.target.value)} className="w-full h-48 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm font-mono" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-300 block mb-1">Output format</label>
              <select value={spec.outputFormat} onChange={e => updateSpec("outputFormat", e.target.value as any)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm">
                <option value="markdown">Markdown (text)</option>
                <option value="pdf">PDF (with charts)</option>
                <option value="xlsx">Excel spreadsheet</option>
                <option value="pptx">PowerPoint deck</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-300 block mb-1">Timeout (minutes)</label>
              <input type="number" min={1} max={30} value={spec.timeoutMin} onChange={e => updateSpec("timeoutMin", Math.min(30, Math.max(1, +e.target.value || 1)))} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm" />
            </div>
          </div>

          {spec.outputFormat === "pdf" && (
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <label className="text-sm font-semibold text-slate-300 block mb-2">Letterhead</label>
              <div className="flex items-center gap-4 mb-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-300"><input type="radio" checked={spec.letterhead.mode === "none"} onChange={() => updateSpec("letterhead", { mode: "none" })} /> None</label>
                <label className="flex items-center gap-1.5 text-xs text-slate-300"><input type="radio" checked={spec.letterhead.mode === "upload"} onChange={() => updateSpec("letterhead", { mode: "upload" })} /> Upload image</label>
              </div>
              {spec.letterhead.mode === "upload" && (
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const fd = new FormData();
                      fd.append("files", f);
                      const r = await fetch("/api/agents/upload", { method: "POST", body: fd });
                      const d = await r.json();
                      if (r.ok && d.files?.[0]) {
                        const previewUrl = URL.createObjectURL(f);
                        updateSpec("letterhead", { mode: "upload", stagedPath: d.files[0].path, previewUrl });
                      } else {
                        setError(d.error || "letterhead upload failed");
                      }
                    }}
                    className="text-xs text-slate-300 file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200 file:text-xs"
                  />
                  {spec.letterhead.previewUrl && <img src={spec.letterhead.previewUrl} alt="letterhead preview" className="max-h-20 rounded border border-slate-700 bg-white p-1" />}
                  <p className="text-[11px] text-slate-500">Goes at the top of every PDF this app produces.</p>
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={spec.shareWithOrg} onChange={e => updateSpec("shareWithOrg", e.target.checked)} />
            Share with the org
          </label>

          {error && <div className="text-red-400 text-sm">{error}</div>}
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white text-sm font-medium">{busy ? "Saving…" : "Save & open"}</button>
            <button onClick={() => setPhase("describe")} className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm">Back</button>
          </div>
        </div>
      )}
    </main>
  );
}
