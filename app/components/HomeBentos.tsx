"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { marked } from "marked";
import { toast } from "sonner";

type Bento = {
  id: string;
  prompt: string;
  title?: string;
  result?: string;
  lastUpdated?: string;
  refreshing?: boolean;
  lastError?: string | null;
  frequencyHours: number;
  createdAt: string;
};

const STALE_AFTER_MS = 60 * 60 * 1000; // visual "stale" hint after 1h regardless of freq

function isStale(b: Bento): boolean {
  if (!b.lastUpdated) return true;
  const ageMs = Date.now() - new Date(b.lastUpdated).getTime();
  return ageMs > b.frequencyHours * 3600 * 1000;
}

function fmtAgo(iso?: string): string {
  if (!iso) return "never";
  const ageS = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (ageS < 60) return `${ageS}s ago`;
  if (ageS < 3600) return `${Math.floor(ageS / 60)}m ago`;
  if (ageS < 86400) return `${Math.floor(ageS / 3600)}h ago`;
  return `${Math.floor(ageS / 86400)}d ago`;
}

export default function HomeBentos() {
  const [bentos, setBentos] = useState<Bento[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newPrompt, setNewPrompt] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const refresh = () => {
    fetch("/api/home-bentos").then(r => r.json()).then(d => {
      setBentos(d.bentos || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, []);

  // Auto-refresh stale bentos on first load
  useEffect(() => {
    if (loading) return;
    for (const b of bentos) {
      if (!b.refreshing && (isStale(b) || (!b.result && !b.lastError))) refreshBento(b.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const refreshBento = async (id: string) => {
    setBentos(prev => prev.map(b => b.id === id ? { ...b, refreshing: true } : b));
    try {
      const r = await fetch(`/api/home-bentos/${id}/refresh`, { method: "POST" });
      const d = await r.json();
      if (d.bento) setBentos(prev => prev.map(b => b.id === id ? d.bento : b));
    } catch {
      setBentos(prev => prev.map(b => b.id === id ? { ...b, refreshing: false, lastError: "Network error" } : b));
    }
  };

  const create = async () => {
    if (!newPrompt.trim() || creating) return;
    setCreating(true);
    try {
      const r = await fetch("/api/home-bentos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: newPrompt, title: newTitle || undefined, frequencyHours: 12 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "create failed");
      setBentos(prev => [...prev, d.bento]);
      setAdding(false);
      setNewPrompt("");
      setNewTitle("");
      // Trigger initial refresh
      refreshBento(d.bento.id);
    } catch (e) {
      toast.error((e as Error).message || "Couldn't create bento");
    } finally {
      setCreating(false);
    }
  };

  const saveEdit = async (b: Bento, prompt: string, title: string, freq: number) => {
    const r = await fetch(`/api/home-bentos/${b.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt, title, frequencyHours: freq }),
    });
    const d = await r.json();
    if (r.ok) {
      setBentos(prev => prev.map(x => x.id === b.id ? d.bento : x));
      setEditingId(null);
      refreshBento(b.id);
    } else {
      toast.error(d.error || "Save failed");
    }
  };

  const del = async (b: Bento) => {
    if (!confirm("Delete this bento?")) return;
    await fetch(`/api/home-bentos/${b.id}`, { method: "DELETE" });
    setBentos(prev => prev.filter(x => x.id !== b.id));
    setEditingId(null);
  };

  return (
    <section className="my-6">
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {loading ? (
          <div className="text-sm text-slate-500 col-span-full">Loading…</div>
        ) : (
          bentos.map(b => {
            const isEditing = editingId === b.id;
            return (
              <BentoCard
                key={b.id}
                bento={b}
                isEditing={isEditing}
                onFlip={() => setEditingId(isEditing ? null : b.id)}
                onRefresh={() => refreshBento(b.id)}
                onSave={(p, t, f) => saveEdit(b, p, t, f)}
                onDelete={() => del(b)}
              />
            );
          })
        )}

        {!loading && (
          <button
            onClick={() => setAdding(true)}
            className="border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-5 min-h-[140px] flex flex-col items-center justify-center text-slate-500 hover:text-indigo-500 hover:border-indigo-400 transition-colors"
          >
            <div className="text-3xl mb-1 leading-none">+</div>
            <div className="text-xs font-medium">Add bento</div>
          </button>
        )}
      </div>

      {adding && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => !creating && setAdding(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg p-5 space-y-3 text-slate-100" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-semibold">New bento</div>
            <p className="text-xs text-slate-400">Describe what you want this card to show. The AI will refresh it on your home page (defaults to every 12 hours, web search on).</p>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Short title (optional, e.g. ATO updates)"
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm"
            />
            <textarea
              value={newPrompt}
              onChange={e => setNewPrompt(e.target.value)}
              placeholder="e.g. Latest ATO releases for small businesses, summarised in 3 bullets. Or: This week's revenue across all my brands. Or: Any AI/LLM news that affects ecommerce platforms."
              rows={5}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm resize-none"
              disabled={creating}
            />
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setAdding(false)} disabled={creating} className="text-sm px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40">Cancel</button>
              <button onClick={create} disabled={creating || !newPrompt.trim()} className="text-sm px-4 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40">
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Flip card shell (same CSS as project bentos in globals.css) ────────────

function FlipCard({
  front, back, flipped, style,
}: {
  front: React.ReactNode;
  back: React.ReactNode;
  flipped: boolean;
  style?: CSSProperties;
}) {
  const frontRef = useRef<HTMLDivElement | null>(null);
  const backRef  = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const active = flipped ? backRef.current : frontRef.current;
    if (!active) return;
    const update = () => setHeight(active.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(active);
    return () => ro.disconnect();
  }, [flipped]);

  return (
    <div
      className="flip-card"
      data-flipped={flipped ? "true" : "false"}
      style={{ ...style, height }}
    >
      <div ref={frontRef} className="flip-face flip-front">{front}</div>
      <div ref={backRef}  className="flip-face flip-back">{back}</div>
    </div>
  );
}

// ─── Card ───────────────────────────────────────────────────────────────────

function BentoCard({
  bento, isEditing, onFlip, onRefresh, onSave, onDelete,
}: {
  bento: Bento;
  isEditing: boolean;
  onFlip: () => void;
  onRefresh: () => void;
  onSave: (prompt: string, title: string, freq: number) => void;
  onDelete: () => void;
}) {
  const [draftPrompt, setDraftPrompt] = useState(bento.prompt);
  const [draftTitle, setDraftTitle] = useState(bento.title || "");
  const [draftFreq, setDraftFreq] = useState(bento.frequencyHours);
  useEffect(() => {
    if (isEditing) {
      setDraftPrompt(bento.prompt);
      setDraftTitle(bento.title || "");
      setDraftFreq(bento.frequencyHours);
    }
  }, [isEditing, bento]);

  const labelTitle = bento.title || (bento.prompt.length > 32 ? bento.prompt.slice(0, 32) + "…" : bento.prompt);

  const cardShell = "relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/40 p-4 min-h-[160px] flex flex-col h-full";

  const front = (
    <div className={cardShell}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-500 truncate">{labelTitle}</div>
        <div className="flex items-center gap-1 shrink-0">
          {bento.refreshing && (
            <span className="text-[10px] text-amber-500 animate-pulse">refreshing…</span>
          )}
          {!bento.refreshing && (
            <button onClick={onRefresh} title="Refresh now" className="text-slate-400 hover:text-indigo-500 text-xs px-1">↻</button>
          )}
          <button onClick={onFlip} title="Edit" className="text-slate-400 hover:text-indigo-500 text-xs px-1">⚙</button>
        </div>
      </div>
      {bento.lastError ? (
        <div className="flex-1 flex items-center justify-center text-xs text-rose-400 text-center">
          Couldn&rsquo;t refresh: {bento.lastError}
        </div>
      ) : !bento.result ? (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-400 italic">
          {bento.refreshing ? "Generating…" : "Empty — click ↻ to refresh"}
        </div>
      ) : (
        <div
          className="flex-1 text-sm text-slate-700 dark:text-slate-200 leading-relaxed overflow-hidden
            [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
            [&_p]:my-1.5
            [&_strong]:font-semibold [&_strong]:text-slate-900 [&_strong]:dark:text-white
            [&_em]:italic
            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5
            [&_li]:my-0.5
            [&_code]:text-amber-600 [&_code]:dark:text-amber-300 [&_code]:bg-slate-100 [&_code]:dark:bg-slate-800/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
            [&_a]:text-indigo-500 hover:[&_a]:underline
            [&_h1]:text-base [&_h1]:font-semibold [&_h1]:my-1.5
            [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:my-1.5
            [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:my-1"
          dangerouslySetInnerHTML={{ __html: marked.parse(bento.result, { breaks: true, gfm: true }) as string }}
        />
      )}
      {bento.lastUpdated && (
        <div className="text-[10px] text-slate-400 mt-2 shrink-0">Updated {fmtAgo(bento.lastUpdated)}</div>
      )}
    </div>
  );

  const back = (
    <div className={cardShell}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-500 truncate">Edit bento</div>
        <button onClick={onFlip} title="Done" className="text-slate-400 hover:text-indigo-500 text-xs px-1">⚙</button>
      </div>
      <div className="flex-1 flex flex-col gap-2">
        <input
          value={draftTitle}
          onChange={e => setDraftTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full bg-slate-950/80 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100"
        />
        <textarea
          value={draftPrompt}
          onChange={e => setDraftPrompt(e.target.value)}
          rows={4}
          className="flex-1 w-full bg-slate-950/80 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 resize-none"
        />
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Refresh every</span>
          <select
            value={draftFreq}
            onChange={e => setDraftFreq(Number(e.target.value))}
            className="bg-slate-950/80 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100"
          >
            <option value={1}>1 hour</option>
            <option value={6}>6 hours</option>
            <option value={12}>12 hours</option>
            <option value={24}>1 day</option>
            <option value={72}>3 days</option>
            <option value={168}>1 week</option>
          </select>
        </div>
        <div className="flex justify-between items-center mt-1">
          <button onClick={onDelete} className="text-xs text-rose-500 hover:text-rose-400">Delete</button>
          <div className="flex gap-2">
            <button onClick={onFlip} className="text-xs px-3 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700">Cancel</button>
            <button
              onClick={() => onSave(draftPrompt, draftTitle, draftFreq)}
              disabled={!draftPrompt.trim()}
              className="text-xs px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40"
            >Save &amp; refresh</button>
          </div>
        </div>
      </div>
    </div>
  );

  return <FlipCard front={front} back={back} flipped={isEditing} />;
}
