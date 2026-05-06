"use client";

import { useEffect } from "react";
import { BRAND_THEME } from "@/lib/brand";

type Theme = Partial<{
  dashboardBg: string;
  sidebarBg: string;
  textColor: string;
  userBubbleBg: string;
  agentBubbleBg: string;
  chatWindowBg: string;
}>;

const STYLE_ID = "mc-theme-overrides";
const STORAGE_KEY = "mc-theme-v1";

function buildCss(t: Theme): string {
  const vars: string[] = [];
  if (t.dashboardBg)    vars.push(`--mc-bg:${t.dashboardBg}`, `--bento-page-bg:${t.dashboardBg}`);
  if (t.sidebarBg)      vars.push(`--mc-sidebar:${t.sidebarBg}`);
  if (t.textColor)      vars.push(`--mc-text:${t.textColor}`);
  if (t.userBubbleBg)   vars.push(`--mc-bubble-user:${t.userBubbleBg}`);
  if (t.agentBubbleBg)  vars.push(`--mc-bubble-agent:${t.agentBubbleBg}`);
  if (t.chatWindowBg)   vars.push(`--mc-chat-bg:${t.chatWindowBg}`);

  const rules: string[] = [];
  if (vars.length) rules.push(`:root{${vars.join(";")}}`);
  if (t.dashboardBg) {
    rules.push(`html,body,.mc-themed-body,.mc-dashboard-shell{background:var(--mc-bg) !important;background-color:var(--mc-bg) !important}`);
    // Many pages wrap their content in their own full-height background
    // (bg-slate-950, bg-[#0f172a], etc). Override the common wrappers so the
    // chosen dashboard bg actually shows through site-wide, not just on pages
    // that happen to be transparent (like /settings).
    rules.push(`.mc-dashboard-shell .min-h-screen[class*='bg-'],.mc-dashboard-shell .min-h-screen[style*='background'],.mc-dashboard-shell [style*='min-height: 100vh'][style*='background'],.mc-dashboard-shell [style*='minHeight: 100vh'][style*='background'],.mc-dashboard-shell .fixed[class*='bg-'][class*='inset-'],.mc-dashboard-shell .fixed[class*='bg-'][class*='inset-x-0']{background:var(--mc-bg) !important;background-color:var(--mc-bg) !important;background-image:none !important}`);
  }
  if (t.sidebarBg)     rules.push(`aside.bg-slate-950,nav.bg-slate-950{background-color:var(--mc-sidebar) !important}`);
  if (t.textColor)     rules.push(`body{color:var(--mc-text)}`);
  if (t.userBubbleBg)  rules.push(`.bg-indigo-600\\/20{background-color:var(--mc-bubble-user) !important}`);
  if (t.agentBubbleBg) rules.push(`.bg-slate-800\\/40{background-color:var(--mc-bubble-agent) !important}`);
  if (t.chatWindowBg)  rules.push(`.bg-slate-950\\/70{background-color:var(--mc-chat-bg) !important}`);
  return rules.join("\n");
}

function apply() {
  if (typeof window === "undefined") return;
  let theme: Theme = { ...BRAND_THEME };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) theme = { ...theme, ...JSON.parse(raw) };
  } catch { /* ignore */ }

  let tag = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = STYLE_ID;
    document.head.appendChild(tag);
  }
  tag.textContent = buildCss(theme);
}

export default function ThemeApplier() {
  useEffect(() => {
    apply();
    const onChange = () => apply();
    window.addEventListener("mc-theme-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("mc-theme-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return null;
}
