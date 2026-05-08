"use client";

import { useEffect, useState } from "react";
import { HexColorPicker } from "react-colorful";
import PixelAvatar from "@/app/components/PixelAvatar";
import BrandingPanel from "@/app/components/BrandingPanel";
import UserThemePanel from "@/app/components/UserThemePanel";
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

const PRESETS: { name: string; theme: Theme }[] = [
  { name: "Midnight (default)", theme: DEFAULTS },
  { name: "Ocean", theme: {
      dashboardBg: "#0b2545", sidebarBg: "#061a35", textColor: "#dbeafe",
      userBubbleBg: "#0ea5e9", agentBubbleBg: "#13315c", chatWindowBg: "#0b2545" } },
  { name: "Forest", theme: {
      dashboardBg: "#1a2e1a", sidebarBg: "#0d1f0d", textColor: "#dcfce7",
      userBubbleBg: "#16a34a", agentBubbleBg: "#243d24", chatWindowBg: "#1a2e1a" } },
  { name: "Sunset", theme: {
      dashboardBg: "#2a1410", sidebarBg: "#1a0a08", textColor: "#fed7aa",
      userBubbleBg: "#f97316", agentBubbleBg: "#3d1f1a", chatWindowBg: "#2a1410" } },
  { name: "Mono", theme: {
      dashboardBg: "#111111", sidebarBg: "#000000", textColor: "#e5e5e5",
      userBubbleBg: "#525252", agentBubbleBg: "#262626", chatWindowBg: "#111111" } },
  { name: "Plum", theme: {
      dashboardBg: "#1e1033", sidebarBg: "#0f0820", textColor: "#e9d5ff",
      userBubbleBg: "#a855f7", agentBubbleBg: "#2d1b4e", chatWindowBg: "#1e1033" } },
  { name: "Slate", theme: {
      dashboardBg: "#1e293b", sidebarBg: "#0f172a", textColor: "#f1f5f9",
      userBubbleBg: "#475569", agentBubbleBg: "#334155", chatWindowBg: "#1e293b" } },
];

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
  const [openPicker, setOpenPicker] = useState<keyof Theme | null>(null);
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

  // --- Change password ---
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function changePassword() {
    setPwMsg(null);
    if (pwNew.length < 8) { setPwMsg({ kind: "err", text: "New password must be at least 8 characters." }); return; }
    if (pwNew !== pwConfirm) { setPwMsg({ kind: "err", text: "New passwords don't match." }); return; }
    setPwBusy(true);
    try {
      const r = await fetch("/api/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.ok) {
        setPwMsg({ kind: "ok", text: "Password updated." });
        setPwCurrent(""); setPwNew(""); setPwConfirm("");
      } else {
        const reason = d?.error === "wrong_password" ? "Current password is wrong."
          : d?.error === "too_short" ? "New password must be at least 8 characters."
          : "Couldn't change password.";
        setPwMsg({ kind: "err", text: reason });
      }
    } catch {
      setPwMsg({ kind: "err", text: "Network error" });
    } finally {
      setPwBusy(false);
    }
  }

  // --- Pending approvals (admin) ---
  type PendingUser = { id: string; username: string; email: string; createdAt: string };
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [pendingBusy, setPendingBusy] = useState<string | null>(null);
  const [pendingErr, setPendingErr] = useState<string | null>(null);

  async function loadPending() {
    try {
      const r = await fetch("/api/admin/users/pending");
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.ok) setPending(d.users || []);
    } catch { /* ignore */ }
  }
  useEffect(() => { if (isAdmin) loadPending(); }, [isAdmin]);

  async function decide(id: string, action: "approve" | "deny") {
    setPendingErr(null);
    setPendingBusy(id);
    try {
      const r = await fetch(`/api/admin/users/${id}/${action}`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.ok) setPendingErr(d?.error || `${action} failed`);
      await loadPending();
    } finally {
      setPendingBusy(null);
    }
  }

  // --- User roles (admin) ---
  type RoleRow = { id: string; username: string; email: string; status: string; role: "admin" | "staff"; isSelf: boolean };
  const [roleRows, setRoleRows] = useState<RoleRow[]>([]);
  const [roleBusy, setRoleBusy] = useState<string | null>(null);
  const [roleErr, setRoleErr] = useState<string | null>(null);
  async function loadRoles() {
    try {
      const r = await fetch("/api/admin/users");
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.ok) setRoleRows(d.users || []);
    } catch { /* ignore */ }
  }
  useEffect(() => { if (isAdmin) loadRoles(); }, [isAdmin]);
  async function changeRole(id: string, role: "admin" | "staff") {
    setRoleErr(null);
    setRoleBusy(id);
    try {
      const r = await fetch(`/api/admin/users/${id}/role`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.ok) setRoleErr(d?.error || "role update failed");
      await loadRoles();
    } finally {
      setRoleBusy(null);
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

      {isAdmin && <BrandingPanel />}
      <UserThemePanel />

      {/* Multi-agent grid (Ava/Mia/Ash/Overseer/Switchboard) removed in
          single-agent strip. Per-user agent rename + reroll lives in the
          Agent panel rendered for all users. */}

      {/* Legacy v1 "Theme presets" section removed — superseded by
          BrandingPanel theme detection + UserThemePanel advanced controls. */}

      <section className="mb-6 space-y-3 bg-slate-900/40 border border-slate-800/60 rounded-xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Change password</h2>
        <div className="grid gap-3 sm:max-w-sm">
          <input
            type="password"
            value={pwCurrent}
            onChange={(e) => setPwCurrent(e.target.value)}
            placeholder="Current password"
            autoComplete="current-password"
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
          <input
            type="password"
            value={pwNew}
            onChange={(e) => setPwNew(e.target.value)}
            placeholder="New password (min 8 chars)"
            autoComplete="new-password"
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
          <input
            type="password"
            value={pwConfirm}
            onChange={(e) => setPwConfirm(e.target.value)}
            placeholder="Confirm new password"
            autoComplete="new-password"
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={changePassword}
            disabled={pwBusy || !pwCurrent || !pwNew}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium"
          >
            {pwBusy ? "Saving…" : "Update password"}
          </button>
          {pwMsg && (
            <span className={`text-xs ${pwMsg.kind === "ok" ? "text-emerald-400" : "text-red-400"}`}>{pwMsg.text}</span>
          )}
        </div>
      </section>

      {isAdmin && (
        <section className="mb-6 space-y-3 bg-slate-900/40 border border-slate-800/60 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Pending approvals</h2>
            <button
              onClick={loadPending}
              className="text-xs text-slate-400 hover:text-slate-200"
            >Refresh</button>
          </div>
          {pending.length === 0 ? (
            <p className="text-xs text-slate-500">No pending registrations.</p>
          ) : (
            <ul className="divide-y divide-slate-800/70">
              {pending.map((u) => (
                <li key={u.id} className="py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200 truncate">{u.username}</div>
                    <div className="text-xs text-slate-500 truncate">{u.email}</div>
                    <div className="text-[11px] text-slate-600">{new Date(u.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => decide(u.id, "approve")}
                      disabled={pendingBusy === u.id}
                      className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium"
                    >Approve</button>
                    <button
                      onClick={() => decide(u.id, "deny")}
                      disabled={pendingBusy === u.id}
                      className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium border border-slate-700"
                    >Deny</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {pendingErr && <p className="text-xs text-red-400">{pendingErr}</p>}
        </section>
      )}

      {isAdmin && (
        <section className="mb-6 space-y-3 bg-slate-900/40 border border-slate-800/60 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">User roles</h2>
            <button onClick={loadRoles} className="text-xs text-slate-400 hover:text-slate-200">Refresh</button>
          </div>
          {roleRows.length === 0 ? (
            <p className="text-xs text-slate-500">No users.</p>
          ) : (
            <ul className="divide-y divide-slate-800/70">
              {roleRows.map((u) => (
                <li key={u.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200 truncate">{u.username}{u.isSelf && <span className="ml-2 text-[10px] text-slate-500">(you)</span>}</div>
                    <div className="text-xs text-slate-500 truncate">{u.email} · {u.status}</div>
                  </div>
                  <select
                    value={u.role}
                    disabled={roleBusy === u.id}
                    onChange={(e) => changeRole(u.id, e.target.value as "admin" | "staff")}
                    className="px-2 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-200 text-xs"
                  >
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                  </select>
                </li>
              ))}
            </ul>
          )}
          {roleErr && <p className="text-xs text-red-400">{roleErr}</p>}
        </section>
      )}

      {/* Legacy v1 "Theme colours" section removed 2026-05-08 — replaced by
          BrandingPanel (admin) + UserThemePanel (everyone) above. */}

    </main>
  );
}
