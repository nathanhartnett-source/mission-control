"use client";

import { useEffect } from "react";

type Theme = Partial<{
  bgApp: string; textApp: string;
  bgSurface: string; textSurface: string;
  bgSidebar: string; textSidebar: string;
  bgBubbleUser: string; textBubbleUser: string;
  bgBubbleAgent: string; textBubbleAgent: string;
  bgComposer: string; textComposer: string;
  textMuted: string;
  textHeading: string;
  textLink: string;
  textSuccess: string;
  textWarning: string;
  textError: string;
  borderDefault: string; borderSubtle: string;
  accent: string; textOnAccent: string;
}>;

const STYLE_ID = "mc-theme-overrides";
const STORAGE_KEY = "mc-theme-v2";
const STORAGE_KEY_V1 = "mc-theme-v1";

function luminance(hex?: string): number {
  if (!hex) return 0.5;
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function buildCss(t: Theme): string {
  const vars: string[] = [];
  const m: Record<string, string | undefined> = {
    "--mc-bg-app": t.bgApp,
    "--mc-text-app": t.textApp,
    "--mc-bg-surface": t.bgSurface,
    "--mc-text-surface": t.textSurface,
    "--mc-bg-sidebar": t.bgSidebar,
    "--mc-text-sidebar": t.textSidebar,
    "--mc-bg-bubble-user": t.bgBubbleUser,
    "--mc-text-bubble-user": t.textBubbleUser,
    "--mc-bg-bubble-agent": t.bgBubbleAgent,
    "--mc-text-bubble-agent": t.textBubbleAgent,
    "--mc-bg-composer": t.bgComposer,
    "--mc-text-composer": t.textComposer,
    "--mc-text-muted": t.textMuted,
    "--mc-text-heading": t.textHeading,
    "--mc-text-link": t.textLink,
    "--mc-text-success": t.textSuccess,
    "--mc-text-warning": t.textWarning,
    "--mc-text-error": t.textError,
    "--mc-border": t.borderDefault,
    "--mc-border-subtle": t.borderSubtle,
    "--mc-accent": t.accent,
    "--mc-text-on-accent": t.textOnAccent,
  };
  for (const [k, v] of Object.entries(m)) if (v) vars.push(`${k}:${v}`);
  // Legacy var names — kept so existing CSS overrides keep working until we
  // migrate every reference to the new names.
  if (t.bgApp) vars.push(`--mc-bg:${t.bgApp}`, `--bento-page-bg:${t.bgApp}`);
  if (t.bgSidebar) vars.push(`--mc-sidebar:${t.bgSidebar}`);
  if (t.textApp) vars.push(`--mc-text:${t.textApp}`);
  if (t.bgBubbleUser) vars.push(`--mc-bubble-user:${t.bgBubbleUser}`);
  if (t.bgBubbleAgent) vars.push(`--mc-bubble-agent:${t.bgBubbleAgent}`);
  if (t.bgComposer) vars.push(`--mc-chat-bg:${t.bgComposer}`);

  const rules: string[] = [];
  if (vars.length) rules.push(`:root{${vars.join(";")}}`);

  if (t.bgApp) {
    rules.push(`html,body,.mc-themed-body,.mc-dashboard-shell{background:var(--mc-bg-app) !important;background-color:var(--mc-bg-app) !important}`);
    rules.push(`.mc-dashboard-shell .min-h-screen[class*='bg-'],.mc-dashboard-shell [style*='min-height: 100vh'][style*='background'],.mc-dashboard-shell .fixed[class*='bg-'][class*='inset-']{background:var(--mc-bg-app) !important;background-color:var(--mc-bg-app) !important;background-image:none !important}`);
  }
  if (t.bgSidebar) rules.push(`aside.bg-slate-950,nav.bg-slate-950,aside[class*='bg-slate'],nav[class*='bg-slate-9']{background-color:var(--mc-bg-sidebar) !important}`);
  if (t.textSidebar) rules.push(`aside.bg-slate-950 *,nav.bg-slate-950 *{color:var(--mc-text-sidebar) !important}`);
  if (t.textApp) rules.push(`body{color:var(--mc-text-app)}`);

  // Surface (cards, panels). Most use bg-slate-900, bg-slate-900/40, bg-slate-900/60.
  if (t.bgSurface) {
    rules.push(`.bg-slate-900,.bg-slate-900\\/40,.bg-slate-900\\/60,.bg-slate-800\\/50{background-color:var(--mc-bg-surface) !important}`);
  }
  if (t.textSurface) {
    // Cards inherit text inside them.
    rules.push(`.bg-slate-900 ,.bg-slate-900\\/40,.bg-slate-900\\/60{color:var(--mc-text-surface)}`);
  }

  // Chat bubbles
  if (t.bgBubbleUser) rules.push(`.bg-indigo-600\\/20,.bg-indigo-600{background-color:var(--mc-bg-bubble-user) !important}`);
  if (t.textBubbleUser) rules.push(`.bg-indigo-600\\/20 *,.bg-indigo-600 *{color:var(--mc-text-bubble-user) !important}`);
  if (t.bgBubbleAgent) rules.push(`.bg-slate-800\\/40,.bg-slate-800\\/60,.bg-slate-800{background-color:var(--mc-bg-bubble-agent) !important}`);
  if (t.textBubbleAgent) rules.push(`.bg-slate-800\\/40 *,.bg-slate-800\\/60 *{color:var(--mc-text-bubble-agent) !important}`);

  // Composer / inputs
  if (t.bgComposer) rules.push(`.bg-slate-950\\/70,textarea.bg-slate-800,input.bg-slate-800{background-color:var(--mc-bg-composer) !important}`);
  if (t.textComposer) rules.push(`textarea.bg-slate-800,input.bg-slate-800{color:var(--mc-text-composer) !important}`);

  // Borders
  if (t.borderDefault) rules.push(`.border-slate-700,.border-slate-800{border-color:var(--mc-border) !important}`);
  if (t.borderSubtle) rules.push(`.border-slate-800\\/60,.border-slate-700\\/60,.border-slate-700\\/30{border-color:var(--mc-border-subtle) !important}`);

  // Accent (primary buttons + links)
  if (t.accent) rules.push(`.bg-indigo-600:not(.bg-indigo-600\\/20),.bg-indigo-500{background-color:var(--mc-accent) !important}`);
  if (t.textOnAccent) rules.push(`.bg-indigo-600:not(.bg-indigo-600\\/20),.bg-indigo-500{color:var(--mc-text-on-accent) !important}`);

  // Light-mode override: when textApp is dark, common Tailwind text-slate-100/200/etc
  // utility classes (used everywhere) still resolve to their hardcoded light slate values
  // and become unreadable on light backgrounds. Override them.
  if (t.textApp && luminance(t.textApp) < 0.5) {
    rules.push(`.text-slate-100,.text-slate-200,.text-slate-300,.text-slate-400,.text-white,h1,h2,h3,h4{color:var(--mc-text-app) !important}`);
    if (t.textMuted) rules.push(`.text-slate-500,.text-slate-600{color:var(--mc-text-muted) !important}`);
  }
  if (t.textMuted) rules.push(`.text-slate-400,.text-slate-500,.text-\\[11px\\]{color:var(--mc-text-muted) !important}`);

  // Status / accent text colour overrides — apply in BOTH light and dark themes
  // so admins can tune any unreadable text via the advanced panel.
  if (t.textHeading) rules.push(`h1,h2,h3,h4,h5,h6{color:var(--mc-text-heading) !important}`);
  if (t.textLink) rules.push(`a:not(.no-theme),.text-indigo-400,.text-indigo-300,.text-violet-400,.text-violet-300,.text-cyan-400{color:var(--mc-text-link) !important}`);
  if (t.textSuccess) rules.push(`.text-emerald-400,.text-emerald-300,.text-emerald-500,.text-green-400,.text-green-300,.text-green-500{color:var(--mc-text-success) !important}`);
  if (t.textWarning) rules.push(`.text-amber-400,.text-amber-300,.text-amber-500,.text-yellow-400,.text-yellow-300{color:var(--mc-text-warning) !important}`);
  if (t.textError) rules.push(`.text-rose-400,.text-rose-300,.text-rose-500,.text-red-400,.text-red-300,.text-red-500{color:var(--mc-text-error) !important}`);

  return rules.join("\n");
}

function loadTheme(): Theme {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    // Migrate v1 if present so admins don't lose their previous detection.
    const v1 = window.localStorage.getItem(STORAGE_KEY_V1);
    if (v1) {
      const old = JSON.parse(v1);
      const migrated: Theme = {
        bgApp: old.dashboardBg,
        bgSidebar: old.sidebarBg,
        textApp: old.textColor,
        bgBubbleUser: old.userBubbleBg,
        bgBubbleAgent: old.agentBubbleBg,
        bgComposer: old.chatWindowBg,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch { /* ignore */ }
  return {};
}

function apply() {
  if (typeof window === "undefined") return;
  const theme = loadTheme();
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
    // Pull server-side branding once on mount so all users (not just the
    // admin who detected the theme) pick it up.
    fetch("/api/branding").then(async (r) => {
      if (!r.ok) return;
      const d = await r.json().catch(() => null);
      if (d?.branding?.theme) {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(d.branding.theme));
          apply();
        } catch {}
      }
    }).catch(() => {});
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
