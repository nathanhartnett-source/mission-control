"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { SkeletonCard } from "../components/Skeleton";
import { BUILTIN_APPS, CATEGORY_LABELS, findBuiltin, type BuiltinApp, type BuiltinAppCategory } from "@/lib/builtin-apps";

type Spec = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  createdBy: string;
  shareWithOrg: boolean;
};

type NavFolder = { id: string; name: string; slugs: string[] };
type NavPrefs = { pinnedOrder: string[]; hiddenSystem: string[]; folders: NavFolder[] };

const DND_MIME = "application/x-mc-slug";
const DND_FROM = "application/x-mc-from"; // "pinned" or "folder:<id>"

function newFolderId(): string {
  return "f_" + Math.random().toString(36).slice(2, 9);
}

export default function MyAppsPage() {
  const [items, setItems] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [prefs, setPrefs] = useState<NavPrefs>({ pinnedOrder: [], hiddenSystem: [], folders: [] });
  const [tab, setTab] = useState<"builtin" | "custom">("builtin");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      setMe((d?.user?.username || "").toLowerCase());
      setIsAdmin(!!d?.user?.isAdmin);
    }).catch(() => {});
    fetch("/api/elements").then(r => r.json()).then(d => { setItems(d.elements || []); setLoading(false); }).catch(() => setLoading(false));
    fetch("/api/nav-prefs").then(r => r.json()).then(d => {
      const p = d.prefs || {};
      setPrefs({
        pinnedOrder: Array.isArray(p.pinnedOrder) ? p.pinnedOrder : (Array.isArray(p.pinnedBuiltins) ? p.pinnedBuiltins : []),
        hiddenSystem: Array.isArray(p.hiddenSystem) ? p.hiddenSystem : [],
        folders: Array.isArray(p.folders) ? p.folders : [],
      });
    }).catch(() => {});
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
    const inPinned = prefs.pinnedOrder.includes(slug);
    const inAnyFolder = prefs.folders.some((f) => f.slugs.includes(slug));
    if (inPinned) {
      savePrefs({ ...prefs, pinnedOrder: prefs.pinnedOrder.filter((s) => s !== slug) });
    } else if (inAnyFolder) {
      savePrefs({ ...prefs, folders: prefs.folders.map((f) => ({ ...f, slugs: f.slugs.filter((s) => s !== slug) })) });
    } else {
      savePrefs({ ...prefs, pinnedOrder: [...prefs.pinnedOrder, slug] });
    }
  };

  const toggleHidden = (slug: string) => {
    const set = new Set(prefs.hiddenSystem);
    if (set.has(slug)) set.delete(slug); else set.add(slug);
    savePrefs({ ...prefs, hiddenSystem: Array.from(set) });
  };

  const createFolder = () => {
    const name = window.prompt("Folder name?", "New folder");
    if (!name || !name.trim()) return;
    savePrefs({ ...prefs, folders: [...prefs.folders, { id: newFolderId(), name: name.trim(), slugs: [] }] });
  };

  const deleteFolder = (id: string) => {
    const folder = prefs.folders.find((f) => f.id === id);
    if (!folder) return;
    if (folder.slugs.length > 0 && !window.confirm(`Delete folder "${folder.name}"? Apps inside will move back to the flat pinned list.`)) return;
    savePrefs({
      ...prefs,
      pinnedOrder: [...prefs.pinnedOrder, ...folder.slugs],
      folders: prefs.folders.filter((f) => f.id !== id),
    });
  };

  const commitRename = (id: string) => {
    const name = renameDraft.trim();
    setRenamingId(null);
    if (!name) return;
    savePrefs({ ...prefs, folders: prefs.folders.map((f) => f.id === id ? { ...f, name } : f) });
  };

  // ── Drag & drop helpers ────────────────────────────────────────────────
  const removeSlugFrom = (next: NavPrefs, slug: string): NavPrefs => ({
    ...next,
    pinnedOrder: next.pinnedOrder.filter((s) => s !== slug),
    folders: next.folders.map((f) => ({ ...f, slugs: f.slugs.filter((s) => s !== slug) })),
  });

  const onDragStart = (e: React.DragEvent, slug: string, from: string) => {
    e.dataTransfer.setData(DND_MIME, slug);
    e.dataTransfer.setData(DND_FROM, from);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes(DND_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  };

  const dropOnPinnedSlot = (e: React.DragEvent, beforeSlug: string | null) => {
    e.preventDefault();
    const slug = e.dataTransfer.getData(DND_MIME);
    if (!slug) return;
    let next = removeSlugFrom(prefs, slug);
    const insertAt = beforeSlug ? next.pinnedOrder.indexOf(beforeSlug) : next.pinnedOrder.length;
    const safeAt = insertAt < 0 ? next.pinnedOrder.length : insertAt;
    next = { ...next, pinnedOrder: [...next.pinnedOrder.slice(0, safeAt), slug, ...next.pinnedOrder.slice(safeAt)] };
    savePrefs(next);
  };

  const dropOnFolder = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    const slug = e.dataTransfer.getData(DND_MIME);
    if (!slug) return;
    let next = removeSlugFrom(prefs, slug);
    next = { ...next, folders: next.folders.map((f) => f.id === folderId ? { ...f, slugs: [...f.slugs, slug] } : f) };
    savePrefs(next);
  };

  const visibleBuiltins = useMemo(() => {
    return BUILTIN_APPS.filter((a) => {
      if (a.adminOnly && isAdmin !== true) return false;
      if (a.nonAdminOnly && isAdmin === true) return false;
      return true;
    });
  }, [isAdmin]);

  const pinnedSet = useMemo(() => new Set([
    ...prefs.pinnedOrder,
    ...prefs.folders.flatMap((f) => f.slugs),
  ]), [prefs]);

  const grouped = useMemo(() => {
    const out: Record<BuiltinAppCategory, BuiltinApp[]> = { core: [], work: [], comms: [], reports: [], admin: [] };
    for (const a of visibleBuiltins) out[a.category].push(a);
    return out;
  }, [visibleBuiltins]);

  const pinnedFlatApps = prefs.pinnedOrder
    .map((s) => findBuiltin(s))
    .filter((a): a is BuiltinApp => !!a);

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 text-slate-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">My Apps</h1>
          <p className="text-sm text-slate-400 mt-1">Pin built-in apps to your sidebar, drag to reorder, or group them in folders.</p>
        </div>
        <Link href="/elements/new" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium">+ Build new</Link>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-800">
        <button onClick={() => setTab("builtin")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "builtin" ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}>Built-in apps</button>
        <button onClick={() => setTab("custom")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "custom" ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}>Custom apps</button>
      </div>

      {tab === "builtin" && (
        <div className="space-y-10">
          {/* Pinned zone (drag-to-reorder) */}
          <section>
            <h2 className="text-[11px] font-semibold tracking-widest uppercase text-slate-500 mb-3">Pinned in sidebar — drag to reorder</h2>
            <div
              className="border border-slate-800 rounded-xl p-3 bg-slate-900/40 min-h-[80px]"
              onDragOver={onDragOver}
              onDrop={(e) => dropOnPinnedSlot(e, null)}
            >
              {pinnedFlatApps.length === 0 ? (
                <div className="text-xs text-slate-500 p-4 text-center">No pinned apps. Drag one in from below, or click ☆ Pin on an app.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {pinnedFlatApps.map((a) => (
                    <div
                      key={a.slug}
                      draggable
                      onDragStart={(e) => onDragStart(e, a.slug, "pinned")}
                      onDragOver={onDragOver}
                      onDrop={(e) => { e.stopPropagation(); dropOnPinnedSlot(e, a.slug); }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 cursor-move hover:bg-slate-700 transition-colors"
                    >
                      <span className="text-slate-600 text-xs">⠿</span>
                      <span className="text-base">{a.icon}</span>
                      <span className="text-sm text-slate-200">{a.name}</span>
                      <button onClick={() => togglePin(a.slug)} title="Unpin" className="text-slate-500 hover:text-rose-400 text-xs ml-1">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Folders */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold tracking-widest uppercase text-slate-500">Folders — drag apps in to group them</h2>
              <button onClick={createFolder} className="text-xs px-3 py-1.5 rounded-md bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-700/30 font-medium">+ New folder</button>
            </div>
            {prefs.folders.length === 0 ? (
              <div className="text-xs text-slate-500 p-6 text-center border border-dashed border-slate-800 rounded-xl">No folders yet. Click "+ New folder" to group related apps.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {prefs.folders.map((f) => (
                  <div
                    key={f.id}
                    className="border border-slate-800 rounded-xl p-4 bg-slate-900/40"
                    onDragOver={onDragOver}
                    onDrop={(e) => dropOnFolder(e, f.id)}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">📂</span>
                      {renamingId === f.id ? (
                        <input
                          autoFocus
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onBlur={() => commitRename(f.id)}
                          onKeyDown={(e) => { if (e.key === "Enter") commitRename(f.id); if (e.key === "Escape") setRenamingId(null); }}
                          className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-sm text-slate-100"
                        />
                      ) : (
                        <button onClick={() => { setRenamingId(f.id); setRenameDraft(f.name); }} className="flex-1 text-left font-semibold text-slate-100 hover:text-indigo-300 truncate">{f.name}</button>
                      )}
                      <button onClick={() => deleteFolder(f.id)} title="Delete folder" className="text-slate-500 hover:text-rose-400 text-xs">×</button>
                    </div>
                    {f.slugs.length === 0 ? (
                      <div className="text-[11px] text-slate-500 italic">Drag apps here</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {f.slugs.map((slug) => {
                          const a = findBuiltin(slug);
                          if (!a) return null;
                          return (
                            <div
                              key={slug}
                              draggable
                              onDragStart={(e) => onDragStart(e, slug, "folder:" + f.id)}
                              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800 border border-slate-700 cursor-move hover:bg-slate-700 transition-colors text-xs"
                            >
                              <span>{a.icon}</span>
                              <span className="text-slate-200">{a.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* All built-in apps, grouped by category */}
          <section>
            <h2 className="text-[11px] font-semibold tracking-widest uppercase text-slate-500 mb-3">All built-in apps</h2>
            <div className="space-y-8">
              {(Object.keys(grouped) as BuiltinAppCategory[]).map((cat) => {
                const apps = grouped[cat];
                if (apps.length === 0) return null;
                return (
                  <div key={cat}>
                    <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-600 mb-2">{CATEGORY_LABELS[cat]}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {apps.map((a) => {
                        const pinned = pinnedSet.has(a.slug);
                        const hidden = prefs.hiddenSystem.includes(a.slug);
                        return (
                          <div
                            key={a.slug}
                            draggable={a.kind === "app"}
                            onDragStart={(e) => a.kind === "app" ? onDragStart(e, a.slug, "all") : e.preventDefault()}
                            className="border border-slate-800 rounded-xl p-4 bg-slate-900/40 hover:bg-slate-900 transition-colors"
                          >
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
                  </div>
                );
              })}
            </div>
          </section>
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
