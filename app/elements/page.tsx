"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
type NavPrefs = { pinnedOrder: string[]; hiddenSystem: string[]; folders: NavFolder[]; purgedBuiltins?: string[] };

function PinIcon({ pinned, size = 16 }: { pinned: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 17v5" />
      <path d="M9 9V4h6v5l3 4H6l3-4z" />
    </svg>
  );
}
function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14M10 11v6M14 11v6" />
    </svg>
  );
}

function newFolderId(): string {
  return "f_" + Math.random().toString(36).slice(2, 9);
}

export default function MyAppsPage() {
  const [items, setItems] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [prefs, setPrefs] = useState<NavPrefs>({ pinnedOrder: [], hiddenSystem: [], folders: [], purgedBuiltins: [] });
  const [tab, setTab] = useState<"builtin" | "custom" | "bin">("builtin");
  const [binItems, setBinItems] = useState<Spec[]>([]);

  const loadBin = () => fetch("/api/elements/bin").then(r => r.json()).then(d => setBinItems(d.elements || [])).catch(() => {});

  const softDelete = async (slug: string, name: string) => {
    const r = await fetch(`/api/elements/${slug}`, { method: "DELETE" });
    if (!r.ok) { toast.error("Delete failed"); return; }
    setItems((curr) => curr.filter((s) => s.slug !== slug));
    // Drop from nav-prefs too so it disappears from sidebar
    const next = removeSlugFrom(prefs, slug);
    if (JSON.stringify(next) !== JSON.stringify(prefs)) savePrefs(next);
    toast.success(`"${name}" moved to bin`);
    loadBin();
  };

  const restore = async (slug: string, name: string) => {
    const r = await fetch(`/api/elements/${slug}/restore`, { method: "POST" });
    if (!r.ok) { const d = await r.json().catch(() => ({})); toast.error(d.error || "Restore failed"); return; }
    toast.success(`"${name}" restored`);
    setBinItems((curr) => curr.filter((s) => s.slug !== slug));
    fetch("/api/elements").then(r => r.json()).then(d => setItems(d.elements || [])).catch(() => {});
  };

  const purge = (slug: string, name: string) => {
    setConfirmModal({
      title: "Delete forever?",
      body: `"${name}" will be permanently deleted. This cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal(null);
        const r = await fetch(`/api/elements/${slug}?permanent=1`, { method: "DELETE" });
        if (!r.ok) { toast.error("Permanent delete failed"); return; }
        setBinItems((curr) => curr.filter((s) => s.slug !== slug));
        toast.success(`"${name}" deleted forever`);
      },
    });
  };

  // Permanently remove a built-in custom-surface app: persists in purgedBuiltins
  // so it's filtered out everywhere (My Apps + Bin) until manually restored.
  const purgeBuiltin = (slug: string, name: string) => {
    setConfirmModal({
      title: "Delete forever?",
      body: `"${name}" will be permanently hidden from your apps. To get it back you'll need to clear it from the underlying preferences file.`,
      onConfirm: () => {
        setConfirmModal(null);
        const purged = Array.from(new Set([...(prefs.purgedBuiltins || []), slug]));
        const hidden = prefs.hiddenSystem.filter((s) => s !== slug);
        savePrefs({ ...prefs, hiddenSystem: hidden, purgedBuiltins: purged });
        toast.success(`"${name}" deleted forever`);
      },
    });
  };
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmModal, setConfirmModal] = useState<{ title: string; body: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      setMe((d?.user?.username || "").toLowerCase());
      setIsAdmin(!!d?.user?.isAdmin);
    }).catch(() => {});
    fetch("/api/elements").then(r => r.json()).then(d => { setItems(d.elements || []); setLoading(false); }).catch(() => setLoading(false));
    loadBin();
    fetch("/api/nav-prefs").then(r => r.json()).then(d => {
      const p = d.prefs || {};
      setPrefs({
        pinnedOrder: Array.isArray(p.pinnedOrder) ? p.pinnedOrder : (Array.isArray(p.pinnedBuiltins) ? p.pinnedBuiltins : []),
        hiddenSystem: Array.isArray(p.hiddenSystem) ? p.hiddenSystem : [],
        folders: Array.isArray(p.folders) ? p.folders : [],
        purgedBuiltins: Array.isArray(p.purgedBuiltins) ? p.purgedBuiltins : [],
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

  // ── Pointer-event-based drag (works in Tauri webview, mobile, everywhere) ───
  const removeSlugFrom = (next: NavPrefs, slug: string): NavPrefs => ({
    ...next,
    pinnedOrder: next.pinnedOrder.filter((s) => s !== slug),
    folders: next.folders.map((f) => ({ ...f, slugs: f.slugs.filter((s) => s !== slug) })),
  });

  const dragRef = useRef<{ slug: string; startX: number; startY: number; active: boolean } | null>(null);
  const [dragSlug, setDragSlug] = useState<string | null>(null);
  const [dragXY, setDragXY] = useState<{ x: number; y: number } | null>(null);
  const [hoverDrop, setHoverDrop] = useState<string | null>(null); // "before:<slug>" | "folder:<id>" | "pinned-end"

  const dropTargetAt = (x: number, y: number): string | null => {
    // Hide ghost from elementFromPoint by temporarily setting pointer-events: none
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const t = (el as HTMLElement).closest("[data-drop]");
    return t ? (t.getAttribute("data-drop") || null) : null;
  };

  const onItemPointerDown = (e: React.PointerEvent, slug: string) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    dragRef.current = { slug, startX: e.clientX, startY: e.clientY, active: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onItemPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.active && Math.hypot(dx, dy) < 5) return;
    if (!d.active) {
      d.active = true;
      setDragSlug(d.slug);
      document.body.style.userSelect = "none";
    }
    setDragXY({ x: e.clientX, y: e.clientY });
    setHoverDrop(dropTargetAt(e.clientX, e.clientY));
  };

  const justDraggedRef = useRef(false);
  const onItemPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    document.body.style.userSelect = "";
    setDragSlug(null);
    setDragXY(null);
    const target = hoverDrop;
    setHoverDrop(null);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    if (!d || !d.active || !target) return;
    justDraggedRef.current = true;
    setTimeout(() => { justDraggedRef.current = false; }, 50);
    const slug = d.slug;
    let next = removeSlugFrom(prefs, slug);
    if (target === "pinned-end") {
      next = { ...next, pinnedOrder: [...next.pinnedOrder, slug] };
    } else if (target.startsWith("before:")) {
      const beforeSlug = target.slice("before:".length);
      const idx = next.pinnedOrder.indexOf(beforeSlug);
      const at = idx < 0 ? next.pinnedOrder.length : idx;
      next = { ...next, pinnedOrder: [...next.pinnedOrder.slice(0, at), slug, ...next.pinnedOrder.slice(at)] };
    } else if (target.startsWith("folder:")) {
      const fid = target.slice("folder:".length);
      next = { ...next, folders: next.folders.map((f) => f.id === fid ? { ...f, slugs: [...f.slugs, slug] } : f) };
    }
    savePrefs(next);
  };

  const visibleForUser = useMemo(() => {
    return BUILTIN_APPS.filter((a) => {
      if (a.adminOnly && isAdmin !== true) return false;
      if (a.nonAdminOnly && isAdmin === true) return false;
      return true;
    });
  }, [isAdmin]);
  const purgedSet = useMemo(() => new Set(prefs.purgedBuiltins || []), [prefs.purgedBuiltins]);
  const visibleBuiltins = useMemo(() => visibleForUser.filter((a) => a.surface !== "custom"), [visibleForUser]);
  const customSurfaceApps = useMemo(
    () => visibleForUser.filter((a) => a.surface === "custom" && !prefs.hiddenSystem.includes(a.slug) && !purgedSet.has(a.slug)),
    [visibleForUser, prefs.hiddenSystem, purgedSet]
  );
  // Bin only shows hidden custom-surface apps that haven't been purged.
  const hiddenBuiltinSlugs = useMemo(
    () => prefs.hiddenSystem.filter((s) => {
      const a = visibleForUser.find((b) => b.slug === s);
      return !!a && a.surface === "custom" && !purgedSet.has(s);
    }),
    [prefs.hiddenSystem, visibleForUser, purgedSet]
  );

  const pinnedSet = useMemo(() => new Set([
    ...prefs.pinnedOrder,
    ...prefs.folders.flatMap((f) => f.slugs),
  ]), [prefs]);

  type AppEntry = { slug: string; name: string; icon: string; href: string; kind: "builtin" | "custom" };
  const resolveApp = (slug: string): AppEntry | null => {
    const b = findBuiltin(slug);
    if (b) return { slug: b.slug, name: b.name, icon: b.icon, href: b.href, kind: "builtin" };
    const c = items.find((i) => i.slug === slug);
    if (c) return { slug: c.slug, name: c.name, icon: c.icon || "✨", href: `/elements/${c.slug}`, kind: "custom" };
    return null;
  };

  const grouped = useMemo(() => {
    const out: Record<BuiltinAppCategory, BuiltinApp[]> = { core: [], work: [], comms: [], reports: [], admin: [] };
    for (const a of visibleBuiltins) out[a.category].push(a);
    return out;
  }, [visibleBuiltins]);

  const pinnedFlatApps: AppEntry[] = prefs.pinnedOrder
    .map((s) => resolveApp(s))
    .filter((a): a is AppEntry => !!a);

  const draggingApp = dragSlug ? resolveApp(dragSlug) : null;

  return (
    <main
      className="max-w-6xl mx-auto px-6 py-10 text-slate-200"
      onClickCapture={(e) => { if (justDraggedRef.current) { e.preventDefault(); e.stopPropagation(); } }}
    >
      {draggingApp && dragXY && (
        <div
          className="fixed z-50 pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-md bg-indigo-600 border border-indigo-400 text-white text-sm shadow-lg"
          style={{ left: dragXY.x + 12, top: dragXY.y + 12 }}
        >
          <span>{draggingApp.icon}</span>
          <span>{draggingApp.name}</span>
        </div>
      )}
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
        <button onClick={() => { setTab("bin"); loadBin(); }} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "bin" ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}>🗑 Bin{binItems.length > 0 ? ` (${binItems.length})` : ""}</button>
      </div>

      {/* Pinned + Folders are shared across Built-in + Custom tabs so any app type can be dragged in */}
      {tab !== "bin" && (
      <div className="space-y-10 mb-10">
          {/* Pinned zone (drag-to-reorder) */}
          <section>
            <h2 className="text-[11px] font-semibold tracking-widest uppercase text-slate-500 mb-3">Pinned in sidebar — drag to reorder</h2>
            <div
              data-drop="pinned-end"
              className={`border rounded-xl p-3 bg-slate-900/40 min-h-[80px] transition-colors ${hoverDrop === "pinned-end" ? "border-indigo-500" : "border-slate-800"}`}
            >
              {pinnedFlatApps.length === 0 ? (
                <div className="text-xs text-slate-500 p-4 text-center">No pinned apps. Drag one in from below, or click ☆ Pin on an app.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {pinnedFlatApps.map((a) => (
                    <div
                      key={a.slug}
                      data-drop={"before:" + a.slug}
                      onPointerDown={(e) => onItemPointerDown(e, a.slug)}
                      onPointerMove={onItemPointerMove}
                      onPointerUp={onItemPointerUp}
                      onPointerCancel={onItemPointerUp}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-grab active:cursor-grabbing transition-colors select-none touch-none ${dragSlug === a.slug ? "opacity-30 bg-slate-800 border-slate-700" : hoverDrop === ("before:" + a.slug) ? "bg-slate-700 border-indigo-500" : "bg-slate-800 border-slate-700 hover:bg-slate-700"}`}
                      style={{ touchAction: "none" }}
                    >
                      <span className="text-slate-600 text-xs">⠿</span>
                      <span className="text-base">{a.icon}</span>
                      <span className="text-sm text-slate-200">{a.name}</span>
                      <button onPointerDown={(e) => e.stopPropagation()} onClick={() => togglePin(a.slug)} title="Unpin" className="text-slate-500 hover:text-rose-400 text-xs ml-1">×</button>
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
                    data-drop={"folder:" + f.id}
                    className={`border rounded-xl p-4 bg-slate-900/40 transition-colors ${hoverDrop === ("folder:" + f.id) ? "border-indigo-500" : "border-slate-800"}`}
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
                          const a = resolveApp(slug);
                          if (!a) return null;
                          return (
                            <div
                              key={slug}
                              onPointerDown={(e) => onItemPointerDown(e, slug)}
                              onPointerMove={onItemPointerMove}
                              onPointerUp={onItemPointerUp}
                              onPointerCancel={onItemPointerUp}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded-md border cursor-grab active:cursor-grabbing transition-colors text-xs select-none touch-none ${dragSlug === slug ? "opacity-30 bg-slate-800 border-slate-700" : "bg-slate-800 border-slate-700 hover:bg-slate-700"}`}
                              style={{ touchAction: "none" }}
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
      </div>
      )}

      {tab === "builtin" && (
        <div className="space-y-10">
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
                            onPointerDown={a.kind === "app" ? (e) => onItemPointerDown(e, a.slug) : undefined}
                            onPointerMove={a.kind === "app" ? onItemPointerMove : undefined}
                            onPointerUp={a.kind === "app" ? onItemPointerUp : undefined}
                            onPointerCancel={a.kind === "app" ? onItemPointerUp : undefined}
                            className={`border border-slate-800 rounded-xl p-4 bg-slate-900/40 hover:bg-slate-900 transition-colors ${a.kind === "app" ? "cursor-grab active:cursor-grabbing" : ""} ${dragSlug === a.slug ? "opacity-30" : ""}`}
                            style={a.kind === "app" ? { touchAction: "none" } : undefined}
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
                                title={pinned ? "Unpin from sidebar" : "Pin to sidebar"}
                                className={`text-sm px-2 py-1 rounded-md transition-colors ${pinned ? "bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-700/30" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                              >
                                <PinIcon pinned={pinned} />
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
        ) : items.length === 0 && customSurfaceApps.length === 0 ? (
          <Link href="/elements/new" className="block border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-12 text-center text-slate-500 hover:text-indigo-400 transition-colors">
            <div className="text-5xl mb-3">+</div>
            <div className="text-base font-medium">Build your first app</div>
            <div className="text-xs mt-1">Describe what you want, your agent builds it.</div>
          </Link>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customSurfaceApps.map(a => {
              const pinned = pinnedSet.has(a.slug);
              return (
                <div
                  key={a.slug}
                  onPointerDown={(e) => onItemPointerDown(e, a.slug)}
                  onPointerMove={onItemPointerMove}
                  onPointerUp={onItemPointerUp}
                  onPointerCancel={onItemPointerUp}
                  className={`block border rounded-xl p-5 bg-slate-900/40 hover:bg-slate-900 transition-colors cursor-grab active:cursor-grabbing select-none ${dragSlug === a.slug ? "opacity-30 border-slate-800" : "border-slate-800 hover:border-indigo-600/50"}`}
                  style={{ touchAction: "none" }}
                >
                  <Link href={a.href} className="block">
                    <div className="text-3xl mb-2">{a.icon}</div>
                    <div className="font-semibold text-slate-100">{a.name}</div>
                    <div className="text-xs text-slate-400 mt-1 line-clamp-2">{a.description}</div>
                  </Link>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">built-in</span>
                    <div className="flex items-center gap-1">
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => toggleHidden(a.slug)}
                        title="Hide from My Apps"
                        className="px-2 py-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      ><TrashIcon /></button>
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => togglePin(a.slug)}
                        title={pinned ? "Unpin from sidebar" : "Pin to sidebar"}
                        className={`px-2 py-1 rounded-md transition-colors ${pinned ? "bg-indigo-600/20 text-indigo-300 border border-indigo-700/30" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                      ><PinIcon pinned={pinned} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
            {items.map(s => {
              const pinned = pinnedSet.has(s.slug);
              return (
                <div
                  key={s.slug}
                  onPointerDown={(e) => onItemPointerDown(e, s.slug)}
                  onPointerMove={onItemPointerMove}
                  onPointerUp={onItemPointerUp}
                  onPointerCancel={onItemPointerUp}
                  className={`block border rounded-xl p-5 bg-slate-900/40 hover:bg-slate-900 transition-colors cursor-grab active:cursor-grabbing select-none ${dragSlug === s.slug ? "opacity-30 border-slate-800" : "border-slate-800 hover:border-indigo-600/50"}`}
                  style={{ touchAction: "none" }}
                >
                  <Link href={`/elements/${s.slug}`} className="block">
                    <div className="text-3xl mb-2">{s.icon || "✨"}</div>
                    <div className="font-semibold text-slate-100">{s.name}</div>
                    <div className="text-xs text-slate-400 mt-1 line-clamp-2">{s.description}</div>
                  </Link>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex gap-1 flex-wrap min-w-0">
                      {s.createdBy !== me && <span className="text-[10px] px-1.5 py-0.5 bg-amber-900/40 text-amber-300 rounded truncate">shared by {s.createdBy}</span>}
                      {s.shareWithOrg && s.createdBy === me && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-900/40 text-emerald-300 rounded">shared</span>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {s.createdBy === me && (
                        <button
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => softDelete(s.slug, s.name)}
                          title="Move to bin"
                          className="text-xs px-2 py-1 rounded-md font-medium text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                        ><TrashIcon /></button>
                      )}
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => togglePin(s.slug)}
                        title={pinned ? "Unpin from sidebar" : "Pin to sidebar"}
                        className={`text-sm px-2 py-1 rounded-md transition-colors ${pinned ? "bg-indigo-600/20 text-indigo-300 border border-indigo-700/30" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                      ><PinIcon pinned={pinned} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
            <Link href="/elements/new" className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-5 flex flex-col items-center justify-center text-slate-500 hover:text-indigo-400 transition-colors min-h-[140px]">
              <div className="text-3xl">+</div>
              <div className="text-xs mt-2">Build new</div>
            </Link>
          </div>
        )
      )}

      {tab === "bin" && (
        binItems.length === 0 && hiddenBuiltinSlugs.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-xl p-12 text-center text-slate-500">
            <div className="text-4xl mb-3">🗑</div>
            <div className="text-sm font-medium">Bin is empty</div>
            <div className="text-xs mt-1">Deleted apps land here. Restore them, or delete forever.</div>
          </div>
        ) : (
          <div className="space-y-8">
            {hiddenBuiltinSlugs.length > 0 && (
              <div>
                <h2 className="text-[11px] font-semibold tracking-widest uppercase text-slate-500 mb-3">Hidden built-in apps</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {hiddenBuiltinSlugs.map((slug) => {
                    const a = visibleForUser.find((b) => b.slug === slug);
                    if (!a) return null;
                    return (
                      <div key={slug} className="block border border-slate-800 rounded-xl p-5 bg-slate-900/40 opacity-80">
                        <div className="text-3xl mb-2">{a.icon}</div>
                        <div className="font-semibold text-slate-100">{a.name}</div>
                        <div className="text-xs text-slate-400 mt-1 line-clamp-2">{a.description}</div>
                        <div className="mt-3 flex items-center gap-2">
                          <button onClick={() => toggleHidden(a.slug)} className="text-xs px-3 py-1.5 rounded-md font-medium bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-700/30">Restore</button>
                          <button onClick={() => purgeBuiltin(a.slug, a.name)} className="text-xs px-3 py-1.5 rounded-md font-medium bg-rose-600 text-white hover:bg-rose-500">Delete forever</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {binItems.length > 0 && (
              <div>
                <h2 className="text-[11px] font-semibold tracking-widest uppercase text-slate-500 mb-3">Deleted custom apps</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {binItems.map(s => (
              <div key={s.slug} className="block border border-slate-800 rounded-xl p-5 bg-slate-900/40 opacity-80">
                <div className="text-3xl mb-2">{s.icon || "✨"}</div>
                <div className="font-semibold text-slate-100">{s.name}</div>
                <div className="text-xs text-slate-400 mt-1 line-clamp-2">{s.description}</div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => restore(s.slug, s.name)}
                    className="text-xs px-3 py-1.5 rounded-md font-medium bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-700/30"
                  >Restore</button>
                  <button
                    onClick={() => purge(s.slug, s.name)}
                    className="text-xs px-3 py-1.5 rounded-md font-medium bg-rose-600 text-white hover:bg-rose-500"
                  >Delete forever</button>
                </div>
              </div>
            ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={() => setConfirmModal(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-semibold text-slate-100 mb-2">{confirmModal.title}</div>
            <div className="text-sm text-slate-400 mb-5">{confirmModal.body}</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmModal(null)} className="text-sm px-4 py-2 rounded-md font-medium bg-slate-800 text-slate-300 hover:bg-slate-700">Cancel</button>
              <button onClick={confirmModal.onConfirm} className="text-sm px-4 py-2 rounded-md font-medium bg-rose-600 text-white hover:bg-rose-500">Delete forever</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
