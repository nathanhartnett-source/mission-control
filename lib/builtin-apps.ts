// Registry of built-in MC apps in the CLEAN repo. Only routes that actually
// exist in mc-demo go here. The Nathan-snapshot ("messy MC") repo has its own
// builtin-apps.ts with many more entries — do NOT port that file here.

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
  surface?: "builtin" | "custom";
};

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
