"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "mc-theme-v2";

const TOKEN_GROUPS: { label: string; tokens: [string, string][] }[] = [
  { label: "Page", tokens: [["bgApp", "Background"], ["textApp", "Text"]] },
  { label: "Surfaces (cards/panels)", tokens: [["bgSurface", "Background"], ["textSurface", "Text"]] },
  { label: "Sidebar", tokens: [["bgSidebar", "Background"], ["textSidebar", "Text"]] },
  { label: "User chat bubble", tokens: [["bgBubbleUser", "Background"], ["textBubbleUser", "Text"]] },
  { label: "Agent chat bubble", tokens: [["bgBubbleAgent", "Background"], ["textBubbleAgent", "Text"]] },
  { label: "Inputs / composer", tokens: [["bgComposer", "Background"], ["textComposer", "Text"]] },
  { label: "Borders", tokens: [["borderDefault", "Default"], ["borderSubtle", "Subtle"]] },
  { label: "Accent", tokens: [["accent", "Background"], ["textOnAccent", "Text"]] },
  { label: "Atoms", tokens: [["textMuted", "Muted text"]] },
  { label: "Status & accent text", tokens: [
    ["textHeading", "Headings"],
    ["textLink", "Links / accent text"],
    ["textSuccess", "Success (green)"],
    ["textWarning", "Warning / thinking (amber)"],
    ["textError", "Error (red)"],
  ]},
];

function applyLocally(theme: Record<string, string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    window.dispatchEvent(new Event("mc-theme-changed"));
  } catch {}
}

export default function UserThemePanel() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [serverTheme, setServerTheme] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  // Seed draft from current localStorage (or server theme as fallback).
  useEffect(() => {
    let theme: Record<string, string> = {};
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) theme = JSON.parse(raw);
    } catch {}
    setDraft(theme);
    fetch("/api/branding").then(async (r) => {
      if (!r.ok) return;
      const d = await r.json().catch(() => null);
      if (d?.branding?.theme) {
        setServerTheme(d.branding.theme);
        if (Object.keys(theme).length === 0) setDraft({ ...d.branding.theme });
      }
    }).catch(() => {});
  }, []);

  const setToken = (k: string, v: string) => {
    const next = { ...draft, [k]: v };
    setDraft(next);
    applyLocally(next);
  };

  const onResetToShared = useCallback(() => {
    setDraft({ ...serverTheme });
    applyLocally(serverTheme);
    try { window.localStorage.removeItem(STORAGE_KEY); window.dispatchEvent(new Event("mc-theme-changed")); } catch {}
    setMsg("Reset to the shared theme");
    setTimeout(() => setMsg(null), 2000);
  }, [serverTheme]);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 mb-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <h2 className="text-base font-semibold text-slate-100">Personalise theme</h2>
          <p className="text-xs text-slate-400 mt-0.5">Tweak any colour for yourself only. Saved to this browser; doesn&apos;t change anyone else&apos;s view.</p>
        </div>
        <span className="text-slate-400 text-sm">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-slate-800 pt-4">
          {TOKEN_GROUPS.map((g) => (
            <div key={g.label}>
              <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">{g.label}</div>
              <div className="grid grid-cols-2 gap-2">
                {g.tokens.map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-[11px] text-slate-300">
                    <input
                      type="color"
                      value={draft[k] || "#000000"}
                      onChange={(e) => setToken(k, e.target.value)}
                      className="h-7 w-9 rounded border border-slate-700 bg-slate-900 cursor-pointer"
                    />
                    <span className="flex-1">{label}</span>
                    <code className="text-slate-500">{draft[k] || "—"}</code>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={onResetToShared}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700"
            >Reset to shared theme</button>
            {msg && <span className="text-xs text-emerald-400">{msg}</span>}
          </div>
          <p className="text-[11px] text-slate-500">Changes apply instantly. To clear personal tweaks and use the shared theme, click Reset.</p>
        </div>
      )}
    </section>
  );
}
