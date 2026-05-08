"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { THEME_PRESETS } from "@/lib/theme-presets";

type Branding = {
  logoPath: string | null;
  theme: Record<string, string>;
  sourceUrl: string | null;
  updatedAt: string | null;
};

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
    ["textHeading", "Headings (h1–h4)"],
    ["textLink", "Links / accent text"],
    ["textSuccess", "Success (green)"],
    ["textWarning", "Warning / thinking (amber)"],
    ["textError", "Error (red)"],
  ]},
];

const STORAGE_KEY = "mc-theme-v2";

function applyLocally(theme: Record<string, string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    window.dispatchEvent(new Event("mc-theme-changed"));
  } catch {}
}

export default function BrandingPanel() {
  const [b, setB] = useState<Branding | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<null | "logo" | "theme" | "delete" | "save" | "clear">(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/branding", { cache: "no-store" });
      const d = await r.json();
      if (d?.ok) {
        setB(d.branding);
        setDraft({ ...(d.branding?.theme || {}) });
      }
    } catch {}
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const onLogo = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy("logo"); setErr(null); setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/admin/branding/logo", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setB(d.branding);
      setMsg("Logo uploaded");
    } catch (e) { setErr(String(e)); }
    finally { setBusy(null); if (fileRef.current) fileRef.current.value = ""; }
  }, []);

  const onDeleteLogo = useCallback(async () => {
    setBusy("delete"); setErr(null); setMsg(null);
    try {
      const r = await fetch("/api/admin/branding/logo", { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setB(d.branding);
      setMsg("Logo removed");
    } catch (e) { setErr(String(e)); }
    finally { setBusy(null); }
  }, []);

  const onDetect = useCallback(async () => {
    if (!/^https?:\/\//i.test(url)) { setErr("Enter a full https:// URL"); return; }
    setBusy("theme"); setErr(null); setMsg(null);
    try {
      const r = await fetch("/api/admin/branding/detect-theme", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setB(d.branding);
      setDraft({ ...(d.theme || {}) });
      applyLocally(d.theme || {});
      setMsg("Theme detected and applied");
    } catch (e) { setErr(String(e)); }
    finally { setBusy(null); }
  }, [url]);

  const onSaveDraft = useCallback(async () => {
    setBusy("save"); setErr(null); setMsg(null);
    try {
      const r = await fetch("/api/admin/branding", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme: draft }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setB(d.branding);
      applyLocally(draft);
      setMsg("Theme saved and applied");
    } catch (e) { setErr(String(e)); }
    finally { setBusy(null); }
  }, [draft]);

  const onClearTheme = useCallback(async () => {
    setBusy("clear"); setErr(null); setMsg(null);
    try {
      const r = await fetch("/api/admin/branding", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme: null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setB(d.branding);
      setDraft({});
      try { window.localStorage.removeItem(STORAGE_KEY); window.dispatchEvent(new Event("mc-theme-changed")); } catch {}
      setMsg("Theme cleared (defaults restored)");
    } catch (e) { setErr(String(e)); }
    finally { setBusy(null); }
  }, []);

  const onApplyPreset = useCallback(async (presetId: string) => {
    const preset = THEME_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setBusy("save"); setErr(null); setMsg(null);
    try {
      const r = await fetch("/api/admin/branding", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme: preset.theme }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setB(d.branding);
      setDraft({ ...preset.theme } as Record<string, string>);
      applyLocally(preset.theme as Record<string, string>);
      setMsg(`Applied ${preset.name}`);
    } catch (e) { setErr(String(e)); }
    finally { setBusy(null); }
  }, []);

  const setToken = (k: string, v: string) => {
    const next = { ...draft, [k]: v };
    setDraft(next);
    applyLocally(next); // live preview as you tweak
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 mb-6">
      <h2 className="text-base font-semibold text-slate-100 mb-1">Branding</h2>
      <p className="text-xs text-slate-400 mb-4">Admin only. Logo replaces the dashboard wordmark; theme detection picks colours from a website.</p>

      <div className="mb-5">
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Logo</div>
        <div className="flex items-center gap-3">
          <div className="h-12 w-32 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-center overflow-hidden">
            {b?.logoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.logoPath} alt="logo" className="max-h-10 max-w-28 object-contain" />
            ) : (
              <span className="text-[11px] text-slate-500">no logo</span>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={onLogo}
            disabled={!!busy}
            className="text-xs text-slate-300"
          />
          {b?.logoPath && (
            <button
              onClick={onDeleteLogo}
              disabled={!!busy}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700"
            >Remove</button>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mt-1">PNG / JPG / SVG / WebP, ≤ 1MB.</p>
      </div>

      <div className="mb-5">
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Detect theme from website</div>
        <div className="flex items-center gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
          />
          <button
            onClick={onDetect}
            disabled={busy === "theme" || !url}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm"
          >{busy === "theme" ? "Detecting…" : "Detect"}</button>
        </div>
        {b?.sourceUrl && <p className="text-[11px] text-slate-500 mt-2">Last detected from {b.sourceUrl}</p>}
        <p className="text-[11px] text-slate-500 mt-1">Detection takes ~30–90s. Applies instantly to all users via server-side branding.</p>
      </div>

      <div className="mb-5">
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Theme presets</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => onApplyPreset(p.id)}
              disabled={busy === "save"}
              className="rounded-lg border border-slate-700 bg-slate-900/60 hover:border-slate-500 disabled:opacity-40 p-2 text-left"
              title={`Apply ${p.name}`}
            >
              <div className="flex gap-1 mb-1.5">
                <span className="h-5 w-5 rounded" style={{ background: p.theme.bgApp }} />
                <span className="h-5 w-5 rounded" style={{ background: p.theme.bgSidebar }} />
                <span className="h-5 w-5 rounded" style={{ background: p.theme.bgBubbleUser }} />
                <span className="h-5 w-5 rounded" style={{ background: p.theme.accent }} />
              </div>
              <div className="text-[11px] text-slate-200">{p.name}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <button
          onClick={() => setAdvancedOpen(o => !o)}
          className="text-xs text-slate-300 hover:text-slate-100 underline"
        >{advancedOpen ? "Hide" : "Show"} advanced colour controls</button>
        {advancedOpen && (
          <div className="mt-3 space-y-4 border-t border-slate-800 pt-4">
            <p className="text-[11px] text-slate-500">Tweak any colour. Changes preview live in your browser; click Save to apply for everyone.</p>
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
                onClick={onSaveDraft}
                disabled={busy === "save"}
                className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs"
              >{busy === "save" ? "Saving…" : "Save for everyone"}</button>
              <button
                onClick={onClearTheme}
                disabled={busy === "clear"}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700"
              >{busy === "clear" ? "Clearing…" : "Reset to defaults"}</button>
            </div>
          </div>
        )}
      </div>

      {err && <div className="mt-3 text-xs text-rose-400">{err}</div>}
      {msg && <div className="mt-3 text-xs text-emerald-400">{msg}</div>}
    </section>
  );
}
