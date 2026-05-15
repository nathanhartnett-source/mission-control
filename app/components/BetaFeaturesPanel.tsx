"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

type Flags = { buildAnApp?: boolean };

export default function BetaFeaturesPanel() {
  const [flags, setFlags] = useState<Flags>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<keyof Flags | null>(null);

  useEffect(() => {
    fetch("/api/settings/features").then(async (r) => {
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        setFlags(d?.flags || {});
      }
      setLoading(false);
    });
  }, []);

  async function toggle(key: keyof Flags, next: boolean) {
    setSaving(key);
    try {
      const r = await fetch("/api/settings/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flags: { [key]: next } }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "save failed");
      setFlags(d.flags || {});
      toast.success(next ? `Enabled ${key}` : `Disabled ${key}`);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  if (loading) return null;

  return (
    <section className="mt-8 border border-slate-800 rounded-xl p-5 bg-slate-900/30">
      <h2 className="text-base font-semibold text-slate-100 mb-1">Beta features</h2>
      <p className="text-xs text-slate-500 mb-4">
        Opt in to features that are still being developed. Admins only — your team won&apos;t see them until you flip these on.
      </p>

      <Row
        title="Build an App"
        desc="Lets you create custom mini-apps with AI (form input → AI run → markdown or PDF output). Beta — the framework is stable for one-shot tasks but doesn't fit multi-page UIs, ongoing pipelines, or stateful workflows. Hidden by default so new installs aren't surprised by it."
        on={!!flags.buildAnApp}
        saving={saving === "buildAnApp"}
        onChange={(v) => toggle("buildAnApp", v)}
      />
    </section>
  );
}

function Row({ title, desc, on, saving, onChange }: { title: string; desc: string; on: boolean; saving: boolean; onChange: (next: boolean) => void }) {
  return (
    <div className="flex items-start gap-4 py-3 border-t border-slate-800/60 first:border-t-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-200 flex items-center gap-2">
          {title}
          <span className="text-[10px] uppercase tracking-wider text-amber-400 bg-amber-950/40 border border-amber-900/40 rounded px-1.5 py-0.5">beta</span>
        </div>
        <div className="text-xs text-slate-400 mt-1 leading-relaxed">{desc}</div>
      </div>
      <button
        onClick={() => onChange(!on)}
        disabled={saving}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-indigo-600" : "bg-slate-700"}`}
        aria-pressed={on}
        aria-label={`Toggle ${title}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}
