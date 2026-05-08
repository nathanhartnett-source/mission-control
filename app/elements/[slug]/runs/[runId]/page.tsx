"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Run = { id: string; status: string; startedAt: string; endedAt?: string; output?: string; error?: string; inputs: Record<string,string>; pdfPath?: string; outputExt?: "pdf" | "xlsx" | "pptx" };

const EXT_LABEL: Record<string, { open: string; mime: string }> = {
  pdf: { open: "Open PDF", mime: "application/pdf" },
  xlsx: { open: "Open Excel", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  pptx: { open: "Open PowerPoint", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
};

export default function RunPage() {
  const { slug, runId } = useParams<{ slug: string; runId: string }>();
  const [run, setRun] = useState<Run | null>(null);

  useEffect(() => {
    let alive = true;
    function pull() {
      fetch(`/api/elements/${slug}/runs/${runId}`).then(r => r.json()).then(d => { if (alive) setRun(d.run); });
    }
    pull();
    const t = setInterval(() => { if (run?.status === "running" || !run) pull(); }, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [slug, runId, run?.status]);

  function download() {
    if (!run?.output) return;
    const blob = new Blob([run.output], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}-${runId}.md`;
    a.click();
  }

  async function kill() {
    if (!confirm("Kill this run?")) return;
    await fetch(`/api/elements/${slug}/runs/${runId}`, { method: "DELETE" });
  }

  if (!run) return <main className="max-w-4xl mx-auto px-6 py-10 text-slate-500">Loading…</main>;

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 text-slate-200">
      <Link href={`/elements/${slug}`} className="text-xs text-slate-500 hover:text-slate-300">← Back</Link>
      <div className="flex items-center justify-between mt-2 mb-4">
        <div>
          <h1 className="text-lg font-semibold">Run {runId}</h1>
          <p className="text-xs text-slate-500">Started {new Date(run.startedAt).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${
            run.status === "done" ? "bg-emerald-900/40 text-emerald-300" :
            run.status === "running" ? "bg-amber-900/40 text-amber-300 animate-pulse" :
            "bg-red-900/40 text-red-300"
          }`}>{run.status}</span>
          {run.status === "running" && <button onClick={kill} className="text-xs text-red-400 hover:text-red-300">Kill</button>}
          {run.pdfPath && (() => {
            const ext = run.outputExt || "pdf";
            const label = EXT_LABEL[ext] || EXT_LABEL.pdf;
            return (
              <>
                <a href={`/api/elements/${slug}/runs/${runId}/pdf`} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1 bg-rose-600 hover:bg-rose-500 rounded text-white">{label.open}</a>
                <a href={`/api/elements/${slug}/runs/${runId}/pdf?download=1`} download={`${slug}-${runId}.${ext}`} className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200">Save…</a>
              </>
            );
          })()}
          {run.output && <button onClick={download} className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-white">Download .md</button>}
        </div>
      </div>

      {Object.keys(run.inputs || {}).length > 0 && (
        <details className="mb-4 border border-slate-800 rounded-lg p-3 bg-slate-900/40">
          <summary className="text-xs text-slate-400 cursor-pointer">Inputs</summary>
          <pre className="text-xs text-slate-300 mt-2 whitespace-pre-wrap">{JSON.stringify(run.inputs, null, 2)}</pre>
        </details>
      )}

      {run.status === "running" && !run.output && (
        <div className="text-sm text-slate-500 italic">Worker is running. This page auto-refreshes every few seconds — feel free to leave; the run continues in the background.</div>
      )}
      {run.error && <div className="text-red-400 text-sm bg-red-950/30 border border-red-900/50 rounded-lg p-3 mb-4 whitespace-pre-wrap">{run.error}</div>}
      {run.output && (
        <div className="border border-slate-800 rounded-xl p-6 bg-slate-950 prose prose-invert prose-sm max-w-none">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{run.output}</pre>
        </div>
      )}
    </main>
  );
}
