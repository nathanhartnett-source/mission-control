"use client";

import { useEffect, useState } from "react";
import PixelAvatar from "@/app/components/PixelAvatar";
import { rollAvatarSeed, agentAvatarSeed } from "@/lib/avatar";

const AGENTS: { slug: string; name: string }[] = [
  { slug: "ava", name: "Ava" },
  { slug: "mia", name: "Mia" },
  { slug: "ash", name: "Ash" },
  { slug: "overseer", name: "Overseer" },
  { slug: "switchboard", name: "Switchboard" },
];

const STORAGE_KEY = "mc-theme-v1";

const DEFAULTS = {
  dashboardBg:    "#0f172a",
  sidebarBg:      "#020617",
  textColor:      "#e2e8f0",
  userBubbleBg:   "#6366f1",
  agentBubbleBg:  "#1e293b",
  chatWindowBg:   "#0f172a",
};

type Theme = typeof DEFAULTS;

const FIELDS: { key: keyof Theme; label: string; hint?: string }[] = [
  { key: "dashboardBg",   label: "Dashboard background" },
  { key: "sidebarBg",     label: "Sidebar / mobile nav background" },
  { key: "textColor",     label: "Body text colour" },
  { key: "userBubbleBg",  label: "Your chat bubble background" },
  { key: "agentBubbleBg", label: "Agent chat bubble background" },
  { key: "chatWindowBg",  label: "Chat window background" },
];

export default function SettingsPage() {
  const [theme, setTheme] = useState<Theme>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [avatarSeed, setAvatarSeedState] = useState<string>("");
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarSaved, setAvatarSaved] = useState(false);
  const [agentSeeds, setAgentSeeds] = useState<Record<string, string>>({});
  const [agentSaving, setAgentSaving] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const loaded = { ...DEFAULTS, ...JSON.parse(raw) };
        setTheme(loaded);
      }
    } catch { /* ignore */ }
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => {
        if (d?.ok && d.user?.avatarSeed) setAvatarSeedState(d.user.avatarSeed);
        if (d?.ok && d.user?.agentAvatarSeeds) setAgentSeeds(d.user.agentAvatarSeeds);
        if (d?.ok) setIsAdmin(!!d.user?.isAdmin);
        if (d?.ok && d.user?.username) setUsername(d.user.username);
      })
      .catch(() => {});
  }, []);

  async function rerollAvatar() {
    const seed = rollAvatarSeed();
    setAvatarSeedState(seed);
    setAvatarSaving(true);
    setAvatarSaved(false);
    try {
      const r = await fetch("/api/me/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed }),
      });
      if (r.ok) {
        setAvatarSaved(true);
        setTimeout(() => setAvatarSaved(false), 1500);
      }
    } finally {
      setAvatarSaving(false);
    }
  }

  async function rerollAgent(slug: string) {
    const seed = rollAvatarSeed();
    setAgentSeeds(prev => ({ ...prev, [slug]: seed }));
    setAgentSaving(slug);
    try {
      await fetch("/api/me/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed, agent: slug }),
      });
    } finally {
      setAgentSaving(null);
    }
  }

  const update = (k: keyof Theme, v: string) => {
    setTheme((t) => ({ ...t, [k]: v }));
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    window.dispatchEvent(new Event("mc-theme-changed"));
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setTheme(DEFAULTS);
    window.dispatchEvent(new Event("mc-theme-changed"));
  };

  return (
    <main className="p-6 md:p-10 max-w-2xl text-slate-200">
      <h1 className="text-2xl font-semibold mb-1">Dashboard Settings</h1>
      <p className="text-sm text-slate-400 mb-6">
        Customise Allhart MC colours. Changes are stored locally in this browser.
      </p>

      <section className="mb-6 space-y-4 bg-slate-900/40 border border-slate-800/60 rounded-xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Avatar</h2>
        <div className="flex items-center gap-4">
          {avatarSeed ? <PixelAvatar seed={avatarSeed} size={72} /> : <div className="w-[72px] h-[72px] rounded-md bg-slate-800" />}
          <div className="flex-1">
            <div className="text-sm text-slate-300 mb-1">Pixel-art avatar</div>
            <div className="text-xs text-slate-500 mb-2">Re-roll until you find one you like. Saves immediately.</div>
            <div className="flex items-center gap-3">
              <button
                onClick={rerollAvatar}
                disabled={avatarSaving}
                className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium"
              >
                🎲 Re-roll
              </button>
              {avatarSaved && <span className="text-xs text-emerald-400">Saved</span>}
            </div>
          </div>
        </div>
      </section>

      {isAdmin && (
        <section className="mb-6 space-y-4 bg-slate-900/40 border border-slate-800/60 rounded-xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Agent avatars</h2>
          <p className="text-xs text-slate-500 -mt-2">Re-roll the pixel-art for each agent. Shows in their chat bubbles everywhere.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {AGENTS.filter(a => username === "nathan" ? (a.slug !== "mia" && a.slug !== "switchboard") : true).map(a => {
              const seed = agentSeeds[a.slug] || agentAvatarSeed(a.slug);
              return (
                <div key={a.slug} className="flex items-center gap-3 rounded-lg border border-slate-800/70 bg-slate-950/30 p-3">
                  <PixelAvatar seed={seed} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200">{a.name}</div>
                    <button
                      onClick={() => rerollAgent(a.slug)}
                      disabled={agentSaving === a.slug}
                      className="mt-1 px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-medium"
                    >🎲 Re-roll</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-4 bg-slate-900/40 border border-slate-800/60 rounded-xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Theme colours</h2>
        {FIELDS.map(({ key, label, hint }) => (
          <div key={key} className="rounded-lg border border-slate-800/70 bg-slate-950/20 p-3 md:border-0 md:bg-transparent md:p-0">
            <label className="flex items-center gap-4">
              <input
                type="color"
                value={theme[key]}
                onChange={(e) => update(key, e.target.value)}
                className="h-12 w-16 shrink-0 cursor-pointer rounded-lg border border-slate-700 bg-transparent p-1 md:h-10 md:w-14"
              />
              <div className="flex-1">
                <div className="text-sm">{label}</div>
                {hint && <div className="text-xs text-slate-500">{hint}</div>}
              </div>
              <code className="text-xs text-slate-500">{theme[key]}</code>
            </label>
          </div>
        ))}
      </section>

      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={save}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
        >
          Save
        </button>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700"
        >
          Reset to defaults
        </button>
        {saved && <span className="text-xs text-emerald-400">Saved</span>}
      </div>
    </main>
  );
}
