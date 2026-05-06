"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useBranding } from "@/lib/use-branding";

const NON_ADMIN_NAV_ALLOW = new Set<string>(["/", "/agents", "/projects", "/todo", "/wiki"]);

function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  home:     "M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125A1.125 1.125 0 005.625 21H9.75v-4.875A1.125 1.125 0 0110.875 15h2.25A1.125 1.125 0 0114.25 16.125V21h4.125A1.125 1.125 0 0019.5 19.875V9.75M8.25 21h8.25",
  support:  "M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.13.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133c.195-.291.515-.475.865-.501a48.17 48.17 0 003.423-.379c1.584-.233 2.707-1.627 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z",
  runs:     "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.42 48.42 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z",
  business: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zm6.75-4.5c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zm6.75-4.5c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  reporting:"M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 8.25v4.5m3-3v3",
  person:   "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
  logout:   "M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75",
  film:     "M3.75 3v18m16.5-18v18M3.75 7.5h16.5M3.75 12h16.5M3.75 16.5h16.5M7.5 3v18m9-18v18",
  target:   "M12 21a9 9 0 100-18 9 9 0 000 18zM12 17a5 5 0 100-10 5 5 0 000 10zM12 13a1 1 0 100-2 1 1 0 000 2z",
  wiki:     "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25A8.966 8.966 0 0118 3.75c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25",
  gear:     "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.213-1.28zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z",
};

const MOBILE_ITEMS = [
  { href: "/",              label: "Home",    icon: "home" },
  { href: "/agents",        label: "Agents",  icon: "person" },
  { href: "/projects",      label: "Projects", icon: "business" },
  { href: "/todo",          label: "To-Do",   icon: "runs", nonAdminOnly: true },
  { href: "/wiki",          label: "Wiki",    icon: "wiki" },
  { href: "/notifications", label: "Alerts",  icon: "support" },
  { href: "/settings",      label: "Settings", icon: "gear" },
] as const;

const SIDEBAR_ITEMS = [
  { href: "/",              label: "Home",          icon: "home" },
  { href: "/agents",        label: "Agents",        icon: "person" },
  { href: "/projects",      label: "Projects",      icon: "business" },
  { href: "/todo",          label: "To-Do",         icon: "runs", nonAdminOnly: true },
  { href: "/wiki",          label: "Wiki",          icon: "wiki" },
  { href: "/notifications", label: "Notifications", icon: "support" },
] as const;

const HIDDEN_PATHS = ["/login"];

export default function Nav() {
  const pathname = usePathname();
  const router   = useRouter();
  const branding = useBranding();
  const BRAND_NAME = branding.name;
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me").then(async (r) => {
      if (!r.ok) return;
      const data = await r.json().catch(() => ({}));
      if (alive) setIsAdmin(!!data?.user?.isAdmin);
    });
    return () => { alive = false; };
  }, []);

  if (HIDDEN_PATHS.some((p) => pathname.startsWith(p))) return null;

  // Default to the restricted menu until we KNOW the user is admin. Previously
  // we showed the full menu while isAdmin was null (loading), which leaked the
  // admin nav to non-admins on first render.
  const filterItems = <T extends { href: string; nonAdminOnly?: boolean }>(items: readonly T[]): T[] =>
    isAdmin === true
      ? items.filter((i) => !i.nonAdminOnly)
      : items.filter((i) => NON_ADMIN_NAV_ALLOW.has(i.href));

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <>
      {/* ── Desktop sidebar ───────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-52 bg-slate-950 border-r border-slate-800/60 z-30">
        <div className="px-5 py-5 border-b border-slate-800/60">
          <span className="text-[11px] font-semibold tracking-widest uppercase text-slate-500">
            {BRAND_NAME}
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {filterItems(SIDEBAR_ITEMS).map(({ href, label, icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-indigo-600/20 text-indigo-300 border border-indigo-700/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent"
                }`}
              >
                <Icon d={ICONS[icon]} size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-slate-800/60 space-y-0.5">
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
          <div className="text-[10px] text-gray-500 text-right px-3">
            v{process.env.NEXT_PUBLIC_BUILD_TIME}
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
        {filterItems(MOBILE_ITEMS).map(({ href, label, icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors whitespace-nowrap shrink-0 basis-[20%] min-w-[72px] ${
                active ? "text-indigo-400" : "text-slate-500 active:text-slate-300"
              }`}
            >
              <Icon d={ICONS[icon]} size={20} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
