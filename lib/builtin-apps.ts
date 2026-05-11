// Registry of built-in MC apps. The Nav and /my-apps grid both read from here.
//
// kind:
//   "locked"     – always visible in nav, cannot be unpinned (Home, Agents)
//   "system"     – installed by default, user can hide from nav (Projects, Wiki)
//   "app"        – only appears in nav if the user has pinned it
//
// Settings, Notifications, Admin, Onboarding, Download are NOT apps — they're
// system chrome and live in the footer / settings area, not /my-apps.

export type BuiltinAppKind = "locked" | "system" | "app";
export type BuiltinAppCategory = "core" | "work" | "comms" | "reports" | "admin";

export type BuiltinApp = {
  slug: string;            // unique key
  name: string;            // display
  description: string;
  href: string;
  icon: string;            // emoji or short text
  kind: BuiltinAppKind;
  category: BuiltinAppCategory;
  nonAdminOnly?: boolean;  // some apps only show for non-admins
  adminOnly?: boolean;
  // Where the app shows on the /elements ("My Apps") manager page.
  //   "builtin" → Built-in apps tab (default)
  //   "custom"  → Custom apps tab, alongside user-built Elements
  surface?: "builtin" | "custom";
};

export const BUILTIN_APPS: BuiltinApp[] = [
  // Core (locked + system)
  { slug: "home",         name: "Home",          description: "Your dashboard overview.",         href: "/",              icon: "🏠", kind: "locked", category: "core" },
  { slug: "agents",       name: "Agents",        description: "Chat with your AI agent.",         href: "/agents",        icon: "🤖", kind: "locked", category: "core" },
  { slug: "projects",     name: "Projects",      description: "Projects + per-project to-dos.",   href: "/projects",      icon: "📁", kind: "system", category: "core" },
  { slug: "wiki",         name: "Wiki",          description: "Shared knowledge + session logs.", href: "/wiki",          icon: "📚", kind: "system", category: "core" },

  // Build an App stays in Built-in (it's the framework entry, not an app)
  { slug: "elements-hub", name: "Build an App",  description: "Build a custom app with AI.",      href: "/elements/new",  icon: "🛠️", kind: "app", category: "work" },

  // Everything below surfaces under "Custom apps" so the My Apps page shows
  // what a populated custom-app view feels like, even though they're hardcoded routes.
  { slug: "todo",         name: "To-Do",         description: "Personal to-do list.",             href: "/todo",          icon: "✅", kind: "app", category: "work",    nonAdminOnly: true, surface: "custom" },
  { slug: "daily-runs",   name: "Daily Runs",    description: "Scheduled automated runs.",        href: "/daily-runs",    icon: "🔁", kind: "app", category: "work",    surface: "custom" },
  { slug: "discussions",  name: "Discussions",   description: "Team discussion threads.",         href: "/discussions",   icon: "💬", kind: "app", category: "comms",   surface: "custom" },
  { slug: "social-review",name: "Social Review", description: "Approve social posts.",            href: "/social-review", icon: "🎬", kind: "app", category: "comms",   surface: "custom" },
  { slug: "support",      name: "Support",       description: "Support tickets.",                 href: "/support",       icon: "🛟", kind: "app", category: "comms",   surface: "custom" },
  { slug: "metrics",      name: "Metrics",       description: "Sales + ops metrics.",             href: "/metrics",       icon: "📊", kind: "app", category: "reports", surface: "custom" },
  { slug: "reporting",    name: "Reporting",     description: "Reports + exports.",               href: "/reporting",     icon: "📈", kind: "app", category: "reports", surface: "custom" },
  { slug: "business",     name: "Business",      description: "Business overview.",               href: "/business",      icon: "🏢", kind: "app", category: "reports", surface: "custom" },
  { slug: "acb",          name: "ACB",           description: "Automated campaign builder.",      href: "/acb",           icon: "🎯", kind: "app", category: "admin",   surface: "custom" },
  { slug: "hq",           name: "HQ",            description: "Org HQ tools.",                    href: "/hq",            icon: "🏛️", kind: "app", category: "admin", adminOnly: true, surface: "custom" },
  { slug: "sprint",       name: "Sprint",        description: "Sprint planning.",                 href: "/sprint",        icon: "🏃", kind: "app", category: "admin",   surface: "custom" },
];

export function findBuiltin(slug: string): BuiltinApp | undefined {
  return BUILTIN_APPS.find((a) => a.slug === slug);
}

export const CATEGORY_LABELS: Record<BuiltinAppCategory, string> = {
  core: "Core",
  work: "Work",
  comms: "Communication",
  reports: "Reports",
  admin: "Admin",
};
