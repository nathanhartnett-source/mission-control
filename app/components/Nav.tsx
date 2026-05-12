"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMe } from "./MeProvider";
import { usePathname, useRouter } from "next/navigation";
import { BUILTIN_APPS, findBuiltin, type BuiltinApp } from "@/lib/builtin-apps";

function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICONS: Record<string, string> = {
  home:     "M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125A1.125 1.125 0 005.625 21H9.75v-4.875A1.125 1.125 0 0110.875 15h2.25A1.125 1.125 0 0114.25 16.125V21h4.125A1.125 1.125 0 0019.5 19.875V9.75M8.25 21h8.25",
  agents:   "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
  projects: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zm6.75-4.5c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zm6.75-4.5c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  wiki:     "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25A8.966 8.966 0 0118 3.75c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25",
  gear:     "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.213-1.28zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z",
  logout:   "M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75",
  apps:     "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z",
};

const HIDDEN_PATHS = ["/login"];

export default function Nav() {
  const pathname = usePathname();
  const router   = useRouter();
  const { me } = useMe();
  const isAdmin: boolean | null = me ? !!me.isAdmin : null;

  type UserElement = { slug: string; name: string; icon: string };
  const [pinnedElements, setPinnedElements] = useState<UserElement[]>([]);
  const [userElements, setUserElements] = useState<UserElement[]>([]);
  type NavFolder = { id: string; name: string; slugs: string[]; icon?: string };
  const [navPrefs, setNavPrefs] = useState<{ pinnedOrder: string[]; hiddenSystem: string[]; folders: NavFolder[]; appIcons?: Record<string, string> }>({ pinnedOrder: [], hiddenSystem: [], folders: [], appIcons: {} });
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const persistPrefs = async (next: typeof navPrefs) => {
    setNavPrefs(next);
    try {
      await fetch("/api/nav-prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      window.dispatchEvent(new Event("mc-nav-prefs-changed"));
    } catch {}
  };

  const renameFolder = (id: string, name: string) => {
    const clean = name.trim();
    setRenamingFolderId(null);
    if (!clean) return;
    persistPrefs({ ...navPrefs, folders: navPrefs.folders.map((f) => f.id === id ? { ...f, name: clean } : f) });
  };

  const deleteFolderFromNav = (id: string) => {
    const folder = navPrefs.folders.find((f) => f.id === id);
    if (!folder) return;
    if (folder.slugs.length > 0 && !window.confirm(`Delete folder "${folder.name}"? Apps inside will move back to the flat pinned list.`)) return;
    persistPrefs({
      ...navPrefs,
      pinnedOrder: [...navPrefs.pinnedOrder, ...folder.slugs],
      folders: navPrefs.folders.filter((f) => f.id !== id),
    });
  };

  // Close folder menu on outside click
  useEffect(() => {
    if (!folderMenuId) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-folder-menu]") && !t.closest("[data-folder-menu-trigger]")) setFolderMenuId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [folderMenuId]);

  useEffect(() => {
    let alive = true;
    fetch("/api/branding").then(async (r) => {
      if (!r.ok) return;
      const data = await r.json().catch(() => ({}));
      if (alive) setLogoPath(data?.branding?.logoPath || null);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    const loadPinnedElements = () => fetch("/api/elements/pinned").then(async (r) => {
      if (!r.ok) return;
      const data = await r.json().catch(() => ({}));
      if (alive) setPinnedElements(Array.isArray(data?.pinned) ? data.pinned : []);
    }).catch(() => {});
    const loadUserElements = () => fetch("/api/elements").then(async (r) => {
      if (!r.ok) return;
      const data = await r.json().catch(() => ({}));
      if (alive) setUserElements(Array.isArray(data?.elements) ? data.elements.map((e: { slug: string; name: string; icon?: string }) => ({ slug: e.slug, name: e.name, icon: e.icon || "✨" })) : []);
    }).catch(() => {});
    loadUserElements();
    const loadNavPrefs = () => fetch("/api/nav-prefs").then(async (r) => {
      if (!r.ok) return;
      const data = await r.json().catch(() => ({}));
      if (alive && data?.prefs) setNavPrefs({
        pinnedOrder: Array.isArray(data.prefs.pinnedOrder) ? data.prefs.pinnedOrder : (Array.isArray(data.prefs.pinnedBuiltins) ? data.prefs.pinnedBuiltins : []),
        hiddenSystem: Array.isArray(data.prefs.hiddenSystem) ? data.prefs.hiddenSystem : [],
        folders: Array.isArray(data.prefs.folders) ? data.prefs.folders : [],
        appIcons: data.prefs.appIcons && typeof data.prefs.appIcons === "object" ? data.prefs.appIcons : {},
      });
    }).catch(() => {});
    loadPinnedElements();
    loadNavPrefs();
    const onNavPrefs = () => loadNavPrefs();
    const onPinned = () => loadPinnedElements();
    window.addEventListener("mc-nav-prefs-changed", onNavPrefs);
    window.addEventListener("mc-pinned-elements-changed", onPinned);
    return () => {
      alive = false;
      window.removeEventListener("mc-nav-prefs-changed", onNavPrefs);
      window.removeEventListener("mc-pinned-elements-changed", onPinned);
    };
  }, [pathname]);

  // Unread agent reply detector.
  const [hasUnreadAgent, setHasUnreadAgent] = useState(false);
  useEffect(() => {
    let alive = true;
    const SEEN_KEY = "mc-agents-last-seen";
    const tick = async () => {
      try {
        const r = await fetch("/api/agents/messages?self=1&limit=5", { cache: "no-store" });
        if (!r.ok || !alive) return;
        const d = await r.json();
        const rows: { agent_ts?: string }[] = d?.rows || [];
        const latest = rows
          .map(x => x.agent_ts ? new Date(x.agent_ts).getTime() : 0)
          .reduce((a, b) => Math.max(a, b), 0);
        const seen = parseInt(localStorage.getItem(SEEN_KEY) || "0", 10) || 0;
        if (alive) setHasUnreadAgent(latest > 0 && latest > seen);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => { alive = false; clearInterval(id); };
  }, [pathname]);
  useEffect(() => {
    if (pathname.startsWith("/agents")) {
      try { localStorage.setItem("mc-agents-last-seen", String(Date.now())); } catch {}
      setHasUnreadAgent(false);
    }
  }, [pathname]);

  // Unread inbox messages (alerts from the agent)
  const [unreadInbox, setUnreadInbox] = useState(0);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/inbox?unread=1&limit=1", { cache: "no-store" });
        if (!r.ok || !alive) return;
        const d = await r.json();
        if (alive) setUnreadInbox(typeof d?.unread === "number" ? d.unread : 0);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 20000);
    const onChange = () => tick();
    window.addEventListener("mc-inbox-changed", onChange);
    return () => { alive = false; clearInterval(id); window.removeEventListener("mc-inbox-changed", onChange); };
  }, [pathname]);
  useEffect(() => {
    if (pathname.startsWith("/inbox")) setUnreadInbox(0);
  }, [pathname]);

  useEffect(() => {
    const targets = ["/agents", "/projects", "/wiki", "/settings", "/elements"];
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const run = () => { for (const t of targets) { try { router.prefetch(t); } catch {} } };
    if (ric) ric(run); else window.setTimeout(run, 1500);
  }, [router]);

  if (HIDDEN_PATHS.some((p) => pathname.startsWith(p))) return null;

  type AppEntry = { slug: string; name: string; icon: string; href: string; kind: "builtin" | "custom" };
  const resolveApp = (slug: string): AppEntry | null => {
    const override = navPrefs.appIcons?.[slug];
    const b = findBuiltin(slug);
    if (b) {
      if (b.adminOnly && isAdmin !== true) return null;
      if (b.nonAdminOnly && isAdmin === true) return null;
      if (b.kind !== "app") return null;
      return { slug: b.slug, name: b.name, icon: override || b.icon, href: b.href, kind: "builtin" };
    }
    const c = userElements.find((e) => e.slug === slug);
    if (c) return { slug: c.slug, name: c.name, icon: override || c.icon || "✨", href: `/elements/${c.slug}`, kind: "custom" };
    return null;
  };

  const hiddenSet = new Set(navPrefs.hiddenSystem);
  const visibleLocked: BuiltinApp[] = BUILTIN_APPS.filter((a) => {
    if (a.adminOnly && isAdmin !== true) return false;
    if (a.nonAdminOnly && isAdmin === true) return false;
    return a.kind === "locked";
  });
  const visibleSystem: BuiltinApp[] = BUILTIN_APPS.filter((a) => {
    if (a.adminOnly && isAdmin !== true) return false;
    if (a.nonAdminOnly && isAdmin === true) return false;
    return a.kind === "system" && !hiddenSet.has(a.slug);
  });
  const pinnedFlatApps: AppEntry[] = navPrefs.pinnedOrder
    .map((slug) => resolveApp(slug))
    .filter((a): a is AppEntry => !!a);
  const folderApps = navPrefs.folders.map((f) => ({
    folder: f,
    apps: f.slugs.map((slug) => resolveApp(slug)).filter((a): a is AppEntry => !!a),
  }));

  const toggleFolder = (id: string) => {
    setOpenFolders((s) => ({ ...s, [id]: !(s[id] ?? true) }));
    try { localStorage.setItem("mc-folder-open-" + id, String(!(openFolders[id] ?? true))); } catch {}
  };
  const isFolderOpen = (id: string) => {
    if (id in openFolders) return openFolders[id];
    try { const v = localStorage.getItem("mc-folder-open-" + id); if (v !== null) return v === "true"; } catch {}
    return true;
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const renderAppIcon = (app: { slug: string; icon: string }, size = 18) => {
    // Single source of truth: emoji from registry/override. SVGs for core
    // built-ins (home/agents/projects/wiki) used to special-case here, but
    // that made the sidebar icons disagree with the My Apps page.
    return <span className="leading-none w-[18px] text-center" style={{ fontSize: size === 18 ? 16 : 20 }}>{app.icon}</span>;
  };

  return (
    <>
      {/* ── Desktop sidebar ───────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-52 bg-slate-950 border-r border-slate-800/60 z-30">
        <div className="px-5 py-5 border-b border-slate-800/60 flex items-center justify-center">
          {logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPath} alt="logo" className="max-h-10 max-w-[160px] object-contain" />
          ) : (
            <span className="text-[11px] font-semibold tracking-widest uppercase text-slate-500">Allhart AIOS</span>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {[...visibleLocked, ...visibleSystem, ...pinnedFlatApps].map((app) => {
            const active = isActive(app.href);
            return (
              <Link
                key={app.slug}
                href={app.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-indigo-600/20 text-indigo-300 border border-indigo-700/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent"
                }`}
              >
                {renderAppIcon({ slug: app.slug, icon: navPrefs.appIcons?.[app.slug] || app.icon })}
                <span className="flex-1">{app.name}</span>
                {app.slug === "agents" && hasUnreadAgent && (
                  <span aria-label="unread agent reply" title="Agent has replied" className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(74,222,128,0.8)]" />
                )}
                {app.slug === "inbox" && unreadInbox > 0 && (
                  <span aria-label={`${unreadInbox} unread`} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-500 text-white min-w-[18px] text-center">{unreadInbox > 99 ? "99+" : unreadInbox}</span>
                )}
              </Link>
            );
          })}
          {folderApps.map(({ folder }) => {
            const href = `/folder/${folder.id}`;
            const active = isActive(href);
            return (
              <div key={folder.id} className="mt-1 relative">
                <div className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${active ? "bg-indigo-600/20 text-indigo-300 border border-indigo-700/30" : "text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent"}`}>
                  <span className="text-base leading-none w-[18px] text-center">{folder.icon || "📂"}</span>
                  {renamingFolderId === folder.id ? (
                    <input
                      autoFocus
                      size={1}
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={() => renameFolder(folder.id, renameDraft)}
                      onKeyDown={(e) => { if (e.key === "Enter") renameFolder(folder.id, renameDraft); if (e.key === "Escape") setRenamingFolderId(null); }}
                      className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-sm text-slate-100"
                    />
                  ) : (
                    <Link href={href} className="truncate flex-1">{folder.name}</Link>
                  )}
                  <button
                    data-folder-menu-trigger
                    onClick={(e) => { e.stopPropagation(); setFolderMenuId(folderMenuId === folder.id ? null : folder.id); }}
                    className="px-1 text-slate-600 hover:text-slate-200"
                    title="Folder options"
                  >⋯</button>
                </div>
                {folderMenuId === folder.id && (
                  <div data-folder-menu className="absolute right-2 top-9 z-40 bg-slate-900 border border-slate-700 rounded-lg shadow-lg py-1 min-w-[120px]">
                    <button
                      onClick={() => { setRenamingFolderId(folder.id); setRenameDraft(folder.name); setFolderMenuId(null); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                    >Rename</button>
                    <button
                      onClick={() => { setFolderMenuId(null); deleteFolderFromNav(folder.id); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-slate-800"
                    >Delete folder</button>
                  </div>
                )}
              </div>
            );
          })}

          {/* My Apps entry — gateway to /elements page where built-ins + custom apps are managed */}
          <Link
            href="/elements"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isActive("/elements")
                ? "bg-indigo-600/20 text-indigo-300 border border-indigo-700/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent"
            }`}
          >
            <Icon d={ICONS.apps} size={18} />
            <span className="flex-1">My Apps</span>
          </Link>

          {(() => {
            const inNavPrefs = new Set<string>([
              ...navPrefs.pinnedOrder,
              ...navPrefs.folders.flatMap((f) => f.slugs),
            ]);
            const legacy = pinnedElements.filter((p) => !inNavPrefs.has(p.slug));
            if (legacy.length === 0) return null;
            return (
            <div className="pt-3 mt-2 border-t border-slate-800/60 space-y-0.5">
              <div className="px-3 pb-1 text-[10px] font-semibold tracking-widest uppercase text-slate-600">Custom apps</div>
              {legacy.map((app) => {
                const href = `/elements/${app.slug}`;
                const active = isActive(href);
                return (
                  <Link
                    key={app.slug}
                    href={href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? "bg-indigo-600/20 text-indigo-300 border border-indigo-700/30"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent"
                    }`}
                  >
                    <span className="text-base leading-none w-[18px] text-center">{app.icon}</span>
                    <span className="truncate">{app.name}</span>
                  </Link>
                );
              })}
            </div>
            );
          })()}
        </nav>

        <div className="px-3 py-4 border-t border-slate-800/60 space-y-0.5">
          <Link
            href="/download"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isActive("/download")
                ? "bg-indigo-600/20 text-indigo-300 border border-indigo-700/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent"
            }`}
            title="Install Mission Control as an app"
          >
            <span className="flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5L10.5 4.5V11.5H3V5.5ZM11.5 4.35L21 3V11.5H11.5V4.35ZM3 12.5H10.5V19.5L3 18.5V12.5ZM11.5 12.5H21V21L11.5 19.65V12.5Z"/></svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12-.99.379-2.07 1.07-2.87.789-.91 2.107-1.59 3.094-1.78zM20.94 17.65c-.561 1.31-1.04 2.55-2.039 3.66-1.439 1.57-3.49 1.91-5.16.92-1.55-.91-2.83-.93-4.46-.01-2.13 1.18-4.42.59-5.91-1.47C.4 16.95-.78 12.18 1.39 9.05c1.07-1.5 2.91-2.43 4.84-2.45 1.39-.02 2.69.94 3.55.94.85 0 2.39-1.16 4.05-1 .68.02 2.65.27 3.91 2.06-3.34 1.94-2.79 6.69.59 7.05z"/></svg>
            </span>
            Get the app
          </Link>
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isActive("/settings")
                ? "bg-indigo-600/20 text-indigo-300 border border-indigo-700/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent"
            }`}
          >
            <Icon d={ICONS.gear} size={18} />
            Settings
          </Link>
          <button
            onClick={signOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition-all border border-transparent"
          >
            <Icon d={ICONS.logout} size={18} />
            Sign out
          </button>
          <div className="text-[10px] text-gray-500 text-left px-3 select-none" data-mc-product-stamp>
            Allhart AIOS v0.1
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom bar ────────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-950 border-t border-slate-800/60 flex overflow-x-auto safe-area-inset-bottom [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorX: "contain",
        }}
      >
        {[
          ...visibleLocked,
          ...visibleSystem,
          ...pinnedFlatApps,
          ...folderApps.map(({ folder }) => ({ slug: `folder-${folder.id}`, name: folder.name, icon: folder.icon || "📂", href: `/folder/${folder.id}`, kind: "custom" as const })),
        ].map((app) => {
          const active = isActive(app.href);
          return (
            <Link
              key={app.slug}
              href={app.href}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors whitespace-nowrap shrink-0 basis-[20%] min-w-[72px] ${
                active ? "text-indigo-400" : "text-slate-500 active:text-slate-300"
              }`}
            >
              <div className="relative">
                {renderAppIcon({ slug: app.slug, icon: navPrefs.appIcons?.[app.slug] || app.icon }, 20)}
                {app.slug === "agents" && hasUnreadAgent && (
                  <span aria-hidden className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(74,222,128,0.8)]" />
                )}
                {app.slug === "inbox" && unreadInbox > 0 && (
                  <span aria-label={`${unreadInbox} unread`} className="absolute -top-1 -right-2 text-[9px] font-semibold px-1 rounded-full bg-rose-500 text-white min-w-[14px] h-[14px] flex items-center justify-center leading-none">{unreadInbox > 9 ? "9+" : unreadInbox}</span>
                )}
              </div>
              {app.name}
            </Link>
          );
        })}
        <Link
          href="/elements"
          className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors whitespace-nowrap shrink-0 basis-[20%] min-w-[72px] ${
            isActive("/elements") ? "text-indigo-400" : "text-slate-500 active:text-slate-300"
          }`}
        >
          <Icon d={ICONS.apps} size={20} />
          My Apps
        </Link>
        {pinnedElements.map((app) => {
          const href = `/elements/${app.slug}`;
          const active = isActive(href);
          return (
            <Link
              key={`pinned-${app.slug}`}
              href={href}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors whitespace-nowrap shrink-0 basis-[20%] min-w-[72px] ${
                active ? "text-indigo-400" : "text-slate-500 active:text-slate-300"
              }`}
            >
              <span className="text-xl leading-none">{app.icon}</span>
              <span className="truncate max-w-[64px]">{app.name}</span>
            </Link>
          );
        })}
        <Link
          href="/settings"
          className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors whitespace-nowrap shrink-0 basis-[20%] min-w-[72px] ${
            isActive("/settings") ? "text-indigo-400" : "text-slate-500 active:text-slate-300"
          }`}
        >
          <Icon d={ICONS.gear} size={20} />
          Settings
        </Link>
      </nav>
    </>
  );
}
