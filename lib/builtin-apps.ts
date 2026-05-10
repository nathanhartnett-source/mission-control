// Registry of built-in MC apps. The Nav and /my-apps grid both read from here.
//
// kind:
//   "locked"     – always visible in nav, cannot be unpinned (Home, Agents)
//   "system"     – installed by default, user can hide from nav (Projects, Wiki)
//   "app"        – only appears in nav if the user has pinned it

export type BuiltinAppKind = "locked" | "system" | "app";
export type BuiltinAppCategory = "core" | "work" | "comms" | "reports" | "admin";

export type BuiltinApp = {
  slug: string;
  name: string;
  description: string;
  href: string;
  icon: string;
  kind: BuiltinAppKind;
  category: BuiltinAppCategory;
  nonAdminOnly?: boolean;
  adminOnly?: boolean;
};

// Clean-repo registry: only includes apps that exist as routes in this build.
// The messy repo has many more apps which are not present here.
export const BUILTIN_APPS: BuiltinApp[] = [
  { slug: "home",         name: "Home",         description: "Your dashboard overview.",         href: "/",             icon: "🏠", kind: "locked", category: "core" },
  { slug: "agents",       name: "Agents",       description: "Chat with your AI agent.",         href: "/agents",       icon: "🤖", kind: "locked", category: "core" },
  { slug: "projects",     name: "Projects",     description: "Projects + per-project to-dos.",   href: "/projects",     icon: "📁", kind: "system", category: "core" },
  { slug: "wiki",         name: "Wiki",         description: "Shared knowledge + session logs.", href: "/wiki",         icon: "📚", kind: "system", category: "core" },
  { slug: "elements-hub", name: "Build an App", description: "Build a custom app with AI.",      href: "/elements/new", icon: "🛠️", kind: "app",    category: "work" },
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
