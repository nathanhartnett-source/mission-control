"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { findBuiltin } from "@/lib/builtin-apps";

type UserElement = { slug: string; name: string; icon: string; description?: string };
type NavFolder = { id: string; name: string; slugs: string[] };
type NavPrefs = { pinnedOrder: string[]; hiddenSystem: string[]; folders: NavFolder[]; purgedBuiltins?: string[] };
type AppEntry = { slug: string; name: string; icon: string; href: string; description: string };

export default function FolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [prefs, setPrefs] = useState<NavPrefs | null>(null);
  const [userElements, setUserElements] = useState<UserElement[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setIsAdmin(!!d?.user?.isAdmin)).catch(() => {});
    fetch("/api/nav-prefs").then(r => r.json()).then(d => setPrefs(d.prefs || null)).catch(() => {});
    fetch("/api/elements").then(r => r.json()).then(d => setUserElements(Array.isArray(d.elements) ? d.elements : [])).catch(() => {});
  }, []);

  if (!prefs) {
    return <main className="max-w-5xl mx-auto px-6 py-10 text-slate-200"><div className="text-sm text-slate-500">Loading…</div></main>;
  }

  const folder = prefs.folders.find((f) => f.id === id);
  if (!folder) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-10 text-slate-200">
        <div className="text-2xl font-semibold mb-2">Folder not found</div>
        <Link href="/elements" className="text-sm text-indigo-400 hover:text-indigo-300">← Back to My Apps</Link>
      </main>
    );
  }

  const resolve = (slug: string): AppEntry | null => {
    const b = findBuiltin(slug);
    if (b) {
      if (b.adminOnly && isAdmin !== true) return null;
      if (b.nonAdminOnly && isAdmin === true) return null;
      return { slug: b.slug, name: b.name, icon: b.icon, href: b.href, description: b.description };
    }
    const c = userElements.find((e) => e.slug === slug);
    if (c) return { slug: c.slug, name: c.name, icon: c.icon || "✨", href: `/elements/${c.slug}`, description: c.description || "" };
    return null;
  };

  const apps = folder.slugs.map(resolve).filter((a): a is AppEntry => !!a);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 text-slate-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📂</span>
          <div>
            <h1 className="text-2xl font-semibold">{folder.name}</h1>
            <p className="text-sm text-slate-400 mt-0.5">{apps.length} {apps.length === 1 ? "app" : "apps"}</p>
          </div>
        </div>
        <Link href="/elements" className="text-sm text-slate-400 hover:text-slate-200">Manage in My Apps →</Link>
      </div>

      {apps.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-xl p-12 text-center text-slate-500">
          <div className="text-4xl mb-3">📂</div>
          <div className="text-sm font-medium">Folder is empty</div>
          <div className="text-xs mt-1">Drag apps here from <Link href="/elements" className="text-indigo-400 hover:text-indigo-300">My Apps</Link>.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {apps.map((a) => (
            <Link key={a.slug} href={a.href} className="block border border-slate-800 hover:border-indigo-600/50 rounded-xl p-5 bg-slate-900/40 hover:bg-slate-900 transition-colors">
              <div className="text-3xl mb-2">{a.icon}</div>
              <div className="font-semibold text-slate-100">{a.name}</div>
              {a.description && <div className="text-xs text-slate-400 mt-1 line-clamp-2">{a.description}</div>}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
