"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SkeletonCard } from "../components/Skeleton";

type Spec = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  createdBy: string;
  shareWithOrg: boolean;
};

export default function ElementsIndex() {
  const [items, setItems] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setMe((d?.user?.username || "").toLowerCase())).catch(() => {});
    fetch("/api/elements").then(r => r.json()).then(d => { setItems(d.elements || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 text-slate-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">My Apps</h1>
          <p className="text-sm text-slate-400 mt-1">Custom elements you've built — and ones shared with the org.</p>
        </div>
        <Link href="/elements/new" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium">+ Build new</Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) :
       items.length === 0 ? (
        <Link href="/elements/new" className="block border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-12 text-center text-slate-500 hover:text-indigo-400 transition-colors">
          <div className="text-5xl mb-3">+</div>
          <div className="text-base font-medium">Build your first element</div>
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
       )}
    </main>
  );
}
