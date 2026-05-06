import path from "path";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function envFlag(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

function csv(name: string): string[] {
  return (process.env[name] || "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function resolveRoot(value: string | undefined, fallback: string): string {
  return path.resolve(value && value.trim() ? value : fallback);
}

export type McPageKey = "home" | "agents" | "wiki" | "login" | "auth-result" | "register" | "todo" | "internal";

const clientMode = envFlag("MC_CLIENT_MODE", false);
const defaultClientPages = ["home", "agents", "wiki"];
const enabledPages = new Set(csv("MC_ENABLED_PAGES").length > 0 ? csv("MC_ENABLED_PAGES") : (clientMode ? defaultClientPages : ["internal"]));
const appDataRoot = resolveRoot(process.env.MC_DATA_ROOT, path.join(process.cwd(), "data"));

export const mcConfig = {
  clientMode,
  appName: process.env.MC_APP_NAME || (clientMode ? "OBT Mission Control" : "Mission Control"),
  brandName: process.env.MC_BRAND_NAME || (clientMode ? "OBT Accounting" : "Hartnett Mission Control"),
  publicOrigin: process.env.MC_PUBLIC_ORIGIN || "",
  enabledPages,
  dataRoot: appDataRoot,
  bentoDataRoot: clientMode
    ? appDataRoot
    : resolveRoot(process.env.MC_DATA_ROOT, path.join(process.cwd(), "../data")),
  wikiRoot: resolveRoot(process.env.MC_WIKI_ROOT, clientMode ? path.join(appDataRoot, "wiki") : "/home/nathan/wiki"),
  uploadRoot: resolveRoot(process.env.MC_UPLOAD_ROOT, clientMode ? path.join(appDataRoot, "uploads") : "/tmp/mc-staging"),
  agentName: process.env.MC_AGENT_NAME || (clientMode ? "OBT Assistant" : "Your agent"),
  agentRunner: process.env.MC_AGENT_RUNNER || "",
  safeAttachmentRoots: csv("MC_SAFE_ATTACHMENT_ROOTS").map((root) => path.resolve(root)),
};

export function publicMcConfig() {
  return {
    clientMode: mcConfig.clientMode,
    appName: mcConfig.appName,
    brandName: mcConfig.brandName,
    agentName: mcConfig.agentName,
    enabledPages: Array.from(mcConfig.enabledPages),
  };
}

export function pageKeyForPath(pathname: string): McPageKey {
  if (pathname === "/") return "home";
  if (pathname === "/agents" || pathname.startsWith("/agents/")) return "agents";
  if (pathname === "/wiki" || pathname.startsWith("/wiki/")) return "wiki";
  if (pathname === "/login") return "login";
  if (pathname === "/register") return "register";
  if (pathname === "/auth/result") return "auth-result";
  if (pathname === "/todo" || pathname.startsWith("/todo/")) return "todo";
  return "internal";
}

export function isPageEnabled(pathname: string): boolean {
  if (!mcConfig.clientMode) return true;
  const key = pageKeyForPath(pathname);
  if (key === "login" || key === "auth-result") return true;
  return mcConfig.enabledPages.has(key);
}

export function isPathInsideRoot(candidate: string, root: string): boolean {
  const resolved = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  return resolved === resolvedRoot || resolved.startsWith(`${resolvedRoot}${path.sep}`);
}

export function clientInboxDir(username = "client"): string {
  const safeUser = username.toLowerCase().replace(/[^a-z0-9_-]/g, "") || "client";
  return path.join(mcConfig.dataRoot, "agent-inbox", safeUser);
}

export function clientOutboxDir(): string {
  return path.join(mcConfig.dataRoot, "agent-outbox");
}

export function agentHistoryDir(): string {
  return mcConfig.clientMode
    ? path.join(mcConfig.dataRoot, "agent-chat")
    : path.join(process.env.HOME || "/home/nathan", "legacy-workspace", "mission-control", "data", "agent-chat");
}
