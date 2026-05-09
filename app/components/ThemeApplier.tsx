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
  // Bento home tiles use --bento-* CSS vars (app/page.tsx). Map them to v2 tokens.
  if (t.bgSurface) vars.push(`--bento-card-bg:${t.bgSurface}`);
  if (t.borderDefault) vars.push(`--bento-border:${t.borderDefault}`);
  if (t.borderSubtle) vars.push(`--bento-border-soft:${t.borderSubtle}`);
  if (t.accent) vars.push(`--bento-accent:${t.accent}`);
  if (t.textApp) vars.push(`--bento-text-primary:${t.textApp}`);
  if (t.textMuted) vars.push(`--bento-text-secondary:${t.textMuted}`, `--bento-text-muted:${t.textMuted}`);

  const rules: string[] = [];
  if (vars.length) rules.push(`:root{${vars.join(";")}}`);

  if (t.bgApp) {
    rules.push(`html,body,.mc-themed-body,.mc-dashboard-shell{background:var(--mc-bg-app) !important;background-color:var(--mc-bg-app) !important}`);
    rules.push(`.mc-dashboard-shell .min-h-screen[class*='bg-'],.mc-dashboard-shell [style*='min-height: 100vh'][style*='background'],.mc-dashboard-shell .fixed[class*='bg-'][class*='inset-']{background:var(--mc-bg-app) !important;background-color:var(--mc-bg-app) !important;background-image:none !important}`);
  }
  if (t.bgSidebar) rules.push(`aside.bg-slate-950,nav.bg-slate-950,aside[class*='bg-slate'],nav[class*='bg-slate-9']{background-color:var(--mc-bg-sidebar) !important}`);
  // Pages like /wiki and /projects use bg-slate-950 on <main> and inner panels.
  // Map them to bgApp (less specific than the aside/nav rule above so sidebars
  // still get bgSidebar).
  if (t.bgApp) rules.push(`main.bg-slate-950,div.bg-slate-950,.bg-slate-950\\/95,.bg-slate-950\\/80,.bg-slate-950\\/70,.bg-slate-950\\/60,.bg-slate-950\\/45,.bg-slate-950\\/30,.bg-slate-950\\/20{background-color:var(--mc-bg-app) !important}`);
  if (t.textSidebar) rules.push(`aside.bg-slate-950 *,nav.bg-slate-950 *{color:var(--mc-text-sidebar) !important}`);
  if (t.textApp) rules.push(`body{color:var(--mc-text-app)}`);

  // Surface (cards, panels). Most use bg-slate-900, bg-slate-900/40, bg-slate-900/60.
  if (t.bgSurface) {
    rules.push(`.bg-slate-900,.bg-slate-900\\/30,.bg-slate-900\\/40,.bg-slate-900\\/45,.bg-slate-900\\/50,.bg-slate-900\\/55,.bg-slate-900\\/60,.bg-slate-900\\/70,.bg-slate-900\\/80,.bg-slate-800\\/30,.bg-slate-800\\/40,.bg-slate-800\\/50,.bg-slate-800\\/60{background-color:var(--mc-bg-surface) !important}`);
  }
  if (t.textSurface) {
    rules.push(`.bg-slate-900,.bg-slate-900\\/30,.bg-slate-900\\/40,.bg-slate-900\\/45,.bg-slate-900\\/50,.bg-slate-900\\/55,.bg-slate-900\\/60,.bg-slate-900\\/70,.bg-slate-800\\/30,.bg-slate-800\\/40,.bg-slate-800\\/50{color:var(--mc-text-surface) !important}`);
    rules.push(`.bg-slate-900 *,.bg-slate-900\\/40 *,.bg-slate-900\\/55 *,.bg-slate-900\\/60 *{color:var(--mc-text-surface)}`);
  }

  // Chat bubbles
  if (t.bgBubbleUser) rules.push(`.bg-indigo-600\\/20,.bg-indigo-600{background-color:var(--mc-bg-bubble-user) !important}`);
  if (t.textBubbleUser) rules.push(`.bg-indigo-600\\/20 *,.bg-indigo-600 *{color:var(--mc-text-bubble-user) !important}`);
  if (t.bgBubbleAgent) rules.push(`.bg-slate-800\\/40,.bg-slate-800\\/60,.bg-slate-800{background-color:var(--mc-bg-bubble-agent) !important}`);
  if (t.textBubbleAgent) rules.push(`.bg-slate-800\\/40 *,.bg-slate-800\\/60 *{color:var(--mc-text-bubble-agent) !important}`);

  // Composer (chat composer specifically — only fires if bgComposer is set).
  if (t.bgComposer) rules.push(`.bg-slate-950\\/70,textarea.bg-slate-800,input.bg-slate-800{background-color:var(--mc-bg-composer) !important}`);
  if (t.textComposer) rules.push(`textarea.bg-slate-800,input.bg-slate-800{color:var(--mc-text-composer) !important}`);

  // Form-input remap (element forms, schedule pickers, etc) — independent of
  // the chat composer setting. Triggered by ANY user-set surface/app/composer
  // colour, because if those are configured the user has a non-default theme
  // and the dark default field bg becomes unreadable on light themes.
  // CSS-var fallback chain: prefer composer, then surface, then app — so even
  // a partially-configured theme picks up SOMETHING readable.
  const formInputs = `textarea.bg-slate-900,input.bg-slate-900,select.bg-slate-900,textarea.bg-slate-950,input.bg-slate-950,select.bg-slate-950`;
  if (t.bgComposer || t.bgSurface || t.bgApp) {
    rules.push(`${formInputs}{background-color:var(--mc-bg-composer, var(--mc-bg-surface, var(--mc-bg-app))) !important}`);
  }
  if (t.textComposer || t.textSurface || t.textApp) {
    rules.push(`${formInputs}{color:var(--mc-text-composer, var(--mc-text-surface, var(--mc-text-app))) !important}`);
  }

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
          // Don't clobber a user's personal theme override on every page load.
          // Only seed from server if the user hasn't customised locally.
          const userLocked = window.localStorage.getItem("mc-theme-user-locked") === "1";
          if (!userLocked) {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(d.branding.theme));
          }
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
