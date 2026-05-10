"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { SkeletonCard } from "../components/Skeleton";
import { BUILTIN_APPS, CATEGORY_LABELS, type BuiltinApp, type BuiltinAppCategory } from "@/lib/builtin-apps";

type Spec = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  createdBy: string;
  shareWithOrg: boolean;
};

type NavPrefs = { pinnedBuiltins: string[]; hiddenSystem: string[] };

export default function MyAppsPage() {
  const [items, setItems] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [prefs, setPrefs] = useState<NavPrefs>({ pinnedBuiltins: [], hiddenSystem: [] });
  const [tab, setTab] = useState<"builtin" | "custom">("builtin");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      setMe((d?.user?.username || "").toLowerCase());
      setIsAdmin(!!d?.user?.isAdmin);
    }).catch(() => {});
    fetch("/api/elements").then(r => r.json()).then(d => { setItems(d.elements || []); setLoading(false); }).catch(() => setLoading(false));
    fetch("/api/nav-prefs").then(r => r.json()).then(d => setPrefs(d.prefs || { pinnedBuiltins: [], hiddenSystem: [] })).catch(() => {});
  }, []);

  const savePrefs = async (next: NavPrefs) => {
    setPrefs(next);
    try {
      const r = await fetch("/api/nav-prefs", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!r.ok) throw new Error();
      window.dispatchEvent(new Event("mc-nav-prefs-changed"));
    } catch {
      toast.error("Couldn't save nav preferences");
    }
  };

  const togglePin = (slug: string) => {
    const set = new Set(prefs.pinnedBuiltins);
    if (set.has(slug)) set.delete(slug); else set.add(slug);
    savePrefs({ ...prefs, pinnedBuiltins: Array.from(set) });
  };

  const toggleHidden = (slug: string) => {
    const set = new Set(prefs.hiddenSystem);
    if (set.has(slug)) set.delete(slug); else set.add(slug);
    savePrefs({ ...prefs, hiddenSystem: Array.from(set) });
  };

  const visibleBuiltins = useMemo(() => {
    return BUILTIN_APPS.filter((a) => {
      if (a.adminOnly && isAdmin !== true) return false;
      if (a.nonAdminOnly && isAdmin === true) return false;
      return true;
    });
  }, [isAdmin]);

  const grouped = useMemo(() => {
    const out: Record<BuiltinAppCategory, BuiltinApp[]> = { core: [], work: [], comms: [], reports: [], admin: [] };
    for (const a of visibleBuiltins) out[a.category].push(a);
    return out;
  }, [visibleBuiltins]);

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 text-slate-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">My Apps</h1>
          <p className="text-sm text-slate-400 mt-1">Pin built-in apps to your sidebar, or build a custom one.</p>
        </div>
        <Link href="/elements/new" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium">+ Build new</Link>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-800">
        <button onClick={() => setTab("builtin")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "builtin" ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}>Built-in apps</button>
        <button onClick={() => setTab("custom")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "custom" ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}>Custom apps</button>
      </div>

      {tab === "builtin" && (
        <div className="space-y-8">
          {(Object.keys(grouped) as BuiltinAppCategory[]).map((cat) => {
            const apps = grouped[cat];
            if (apps.length === 0) return null;
            return (
              <section key={cat}>
                <h2 className="text-[11px] font-semibold tracking-widest uppercase text-slate-500 mb-3">{CATEGORY_LABELS[cat]}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {apps.map((a) => {
                    const pinned = prefs.pinnedBuiltins.includes(a.slug);
                    const hidden = prefs.hiddenSystem.includes(a.slug);
                    return (
                      <div key={a.slug} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40 hover:bg-slate-900 transition-colors">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="text-2xl">{a.icon}</div>
                          <div className="flex-1 min-w-0">
                            <Link href={a.href} className="font-semibold text-slate-100 hover:text-indigo-300 truncate block">{a.name}</Link>
                            <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{a.description}</div>
                          </div>
                        </div>
                        {a.kind === "locked" && (
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Always in nav</div>
                        )}
                        {a.kind === "system" && (
                          <button
                            onClick={() => toggleHidden(a.slug)}
                            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${hidden ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-700/30"}`}
                          >
                            {hidden ? "Show in nav" : "Hide from nav"}
                          </button>
                        )}
                        {a.kind === "app" && (
                          <button
                            onClick={() => togglePin(a.slug)}
                            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${pinned ? "bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-700/30" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                          >
                            {pinned ? "★ Pinned" : "☆ Pin to nav"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {tab === "custom" && (
        loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <Link href="/elements/new" className="block border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-12 text-center text-slate-500 hover:text-indigo-400 transition-colors">
            <div className="text-5xl mb-3">+</div>
            <div className="text-base font-medium">Build your first app</div>
            <div className="text-xs mt-1">Describe what you want, your agent builds it.</div>
          </Link>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(s => (
              <Link key={s.slug} href={`/elements/${s.slug}`} className="block border border-slate-800 hover:border-indigo-600/50 rounded-xl p-5 bg-slate-900/40 hover:bg-slate-900 transition-colors">
                <div className="text-3xl mb-2">{s.icon || "✨"}</div>
                <div className="font-semibold text-slate-100">{s.name}</div>
                <div className="text-xs text-slate-400 mt-1 line-clamp-2">{s.description}</div>
                <div className="text-[10px] text-slate-600 mt-3 flex gap-2">
                  {s.createdBy !== me && <span className="px-1.5 py-0.5 bg-amber-900/40 text-amber-300 rounded">shared by {s.createdBy}</span>}
                  {s.shareWithOrg && s.createdBy === me && <span className="px-1.5 py-0.5 bg-emerald-900/40 text-emerald-300 rounded">shared</span>}
                </div>
              </Link>
            ))}
            <Link href="/elements/new" className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-5 flex flex-col items-center justify-center text-slate-500 hover:text-indigo-400 transition-colors min-h-[140px]">
              <div className="text-3xl">+</div>
              <div className="text-xs mt-2">Build new</div>
            </Link>
          </div>
        )
      )}
    </main>
  );
}
