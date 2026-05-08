"use client";

import { useEffect, useState } from "react";
import { HexColorPicker } from "react-colorful";
import PixelAvatar from "@/app/components/PixelAvatar";
import BrandingPanel from "@/app/components/BrandingPanel";
import UserThemePanel from "@/app/components/UserThemePanel";
import { rollAvatarSeed, agentAvatarSeed } from "@/lib/avatar";
import { BRAND_THEME } from "@/lib/brand";
import { useBranding } from "@/lib/use-branding";

const AGENTS: { slug: string; name: string }[] = [
  { slug: "ava", name: "Ava" },
  { slug: "mia", name: "Mia" },
  { slug: "ash", name: "Ash" },
  { slug: "overseer", name: "Overseer" },
  { slug: "switchboard", name: "Switchboard" },
];

const STORAGE_KEY = "mc-theme-v1";

const DEFAULTS = { ...BRAND_THEME };

type Theme = typeof DEFAULTS;

const PRESETS: { name: string; theme: Theme }[] = [
  { name: "Midnight (default)", theme: DEFAULTS },
  { name: "Ocean", theme: { ...DEFAULTS,
      dashboardBg: "#0b2545", sidebarBg: "#061a35", textColor: "#dbeafe",
      userBubbleBg: "#0ea5e9", agentBubbleBg: "#13315c", chatWindowBg: "#0b2545" } },
  { name: "Forest", theme: { ...DEFAULTS,
      dashboardBg: "#1a2e1a", sidebarBg: "#0d1f0d", textColor: "#dcfce7",
      userBubbleBg: "#16a34a", agentBubbleBg: "#243d24", chatWindowBg: "#1a2e1a" } },
  { name: "Sunset", theme: { ...DEFAULTS,
      dashboardBg: "#2a1410", sidebarBg: "#1a0a08", textColor: "#fed7aa",
      userBubbleBg: "#f97316", agentBubbleBg: "#3d1f1a", chatWindowBg: "#2a1410" } },
  { name: "Mono", theme: { ...DEFAULTS,
      dashboardBg: "#111111", sidebarBg: "#000000", textColor: "#e5e5e5",
      userBubbleBg: "#525252", agentBubbleBg: "#262626", chatWindowBg: "#111111" } },
  { name: "Plum", theme: { ...DEFAULTS,
      dashboardBg: "#1e1033", sidebarBg: "#0f0820", textColor: "#e9d5ff",
      userBubbleBg: "#a855f7", agentBubbleBg: "#2d1b4e", chatWindowBg: "#1e1033" } },
  { name: "Slate", theme: { ...DEFAULTS,
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
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const [agentNameSaving, setAgentNameSaving] = useState<string | null>(null);
  const [agentNameSavedSlug, setAgentNameSavedSlug] = useState<string | null>(null);
  const [userAgentName, setUserAgentName] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [clientMode, setClientMode] = useState(false);
  const [username, setUsername] = useState<string>("");
  const branding = useBranding();
  const BRAND_NAME = branding.name;
  const [brandName, setBrandName] = useState<string>("");
  const [brandLogoData, setBrandLogoData] = useState<string>("");
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandSaved, setBrandSaved] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);
  useEffect(() => {
    setBrandName(branding.name);
    setBrandLogoData(branding.logoDataUrl || "");
  }, [branding.name, branding.logoDataUrl]);

  async function onLogoFile(f: File | null) {
    setBrandError(null);
    if (!f) { setBrandLogoData(""); return; }
    if (f.size > 600_000) { setBrandError("Logo must be under 600KB."); return; }
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result || ""));
      r.onerror = () => rej(new Error("read failed"));
      r.readAsDataURL(f);
    });
    setBrandLogoData(dataUrl);
  }

  async function saveBranding() {
    setBrandSaving(true);
    setBrandError(null);
    try {
      const body: Record<string, unknown> = { name: brandName };
      if (brandLogoData) body.logoDataUrl = brandLogoData;
      else body.clearLogo = true;
      const r = await fetch("/api/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.ok) {
        setBrandError(d?.error || "Save failed");
      } else {
        setBrandSaved(true);
        setTimeout(() => setBrandSaved(false), 1800);
        // refresh injected branding so subsequent navigations pick it up
        if (typeof window !== "undefined") {
          (window as unknown as { __MC_BRANDING__?: unknown }).__MC_BRANDING__ = d.branding;
        }
      }
    } catch {
      setBrandError("Network error");
    } finally {
      setBrandSaving(false);
    }
  }

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
        if (d?.ok && d.user?.agentNames) setAgentNames(d.user.agentNames);
        if (d?.ok && d.user?.agentName) setUserAgentName(d.user.agentName);
        if (d?.ok) setIsAdmin(!!d.user?.isAdmin);
        if (d) setClientMode(!!d.clientMode);
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

  async function saveAgentName(slug: string, name: string) {
    setAgentNameSaving(slug);
    setAgentNameSavedSlug(null);
    try {
      const r = await fetch("/api/me/agent-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: slug, name }),
      });
      if (r.ok) {
        setAgentNameSavedSlug(slug);
        setTimeout(() => setAgentNameSavedSlug(prev => prev === slug ? null : prev), 1500);
      }
    } finally {
      setAgentNameSaving(null);
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
  type PendingUser = { id: string; username: string; email: string; createdAt: string; justApproved?: boolean };
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [pendingBusy, setPendingBusy] = useState<string | null>(null);
  const [pendingErr, setPendingErr] = useState<string | null>(null);

  async function loadPending() {
    try {
      const r = await fetch("/api/admin/users/pending");
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.ok) {
        const fresh: PendingUser[] = d.users || [];
        // Preserve any rows we just approved this session so the admin can still set their role.
        setPending((prev) => {
          const stillJustApproved = prev.filter((p) => p.justApproved && !fresh.find((f) => f.id === p.id));
          return [...stillJustApproved, ...fresh];
        });
      }
    } catch { /* ignore */ }
  }
  useEffect(() => { if (isAdmin) loadPending(); }, [isAdmin]);

  async function decide(id: string, action: "approve" | "deny") {
    setPendingErr(null);
    setPendingBusy(id);
    try {
      const r = await fetch(`/api/admin/users/${id}/${action}`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.ok) {
        setPendingErr(d?.error || `${action} failed`);
        return;
      }
      if (action === "approve") {
        // Keep the row visible inline so the admin can set a role immediately.
        setPending((prev) => prev.map((p) => p.id === id ? { ...p, justApproved: true } : p));
        await loadRoles();
      } else {
        await loadPending();
      }
    } finally {
      setPendingBusy(null);
    }
  }

  // --- User roles (admin) ---
  type Role = "admin" | "staff" | "client";
  type RoleRow = { id: string; username: string; email: string; status: string; role: Role; isSelf: boolean };
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
  async function changeRole(id: string, role: Role) {
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

  // --- Updates (admin) ---
  type UpdateInfo = { head: string; remote: string; branch: string; behind: number; commits: string[] };
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateDeploying, setUpdateDeploying] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [waitingForRestart, setWaitingForRestart] = useState(false);

  async function checkUpdates() {
    setUpdateChecking(true);
    setUpdateMsg(null);
    try {
      const r = await fetch("/api/admin/updates/check");
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.ok) {
        setUpdateInfo({ head: d.head, remote: d.remote, branch: d.branch, behind: d.behind, commits: d.commits || [] });
      } else {
        setUpdateMsg({ kind: "err", text: d?.error || "Check failed" });
      }
    } catch {
      setUpdateMsg({ kind: "err", text: "Network error" });
    } finally {
      setUpdateChecking(false);
    }
  }
  useEffect(() => { if (isAdmin) checkUpdates(); }, [isAdmin]);

  async function pollHealth() {
    setWaitingForRestart(true);
    const start = Date.now();
    while (Date.now() - start < 90_000) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        if (r.ok) {
          setWaitingForRestart(false);
          window.location.reload();
          return;
        }
      } catch { /* still down */ }
    }
    setWaitingForRestart(false);
    setUpdateMsg({ kind: "err", text: "Service didn't come back within 90s — check server logs." });
  }

  async function deployUpdates() {
    if (!confirm("Pull, rebuild, and restart Mission Control? The dashboard will be unavailable for ~30 seconds.")) return;
    setUpdateDeploying(true);
    setUpdateMsg(null);
    try {
      const r = await fetch("/api/admin/updates/deploy", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.ok) {
        setUpdateMsg({ kind: "ok", text: "Build succeeded — restarting service…" });
        await pollHealth();
      } else {
        const stderr = d?.stderr ? `\n\n${d.stderr}` : "";
        setUpdateMsg({ kind: "err", text: `${d?.step || "deploy"} failed: ${d?.error || "unknown"}${stderr}` });
      }
    } catch {
      setUpdateMsg({ kind: "err", text: "Network error" });
    } finally {
      setUpdateDeploying(false);
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
        Customise {BRAND_NAME} colours. Changes are stored locally in this browser.
      </p>

      {isAdmin && <BrandingPanel />}
      <UserThemePanel />

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

      {clientMode ? (
        <section className="mb-6 space-y-4 bg-slate-900/40 border border-slate-800/60 rounded-xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Your agent</h2>
          <p className="text-xs text-slate-500 -mt-2">Name and pixel-art for the agent that talks to you in MC.</p>
          {(() => {
            const slug = "me";
            const seed = agentSeeds[slug] || agentAvatarSeed(slug);
            const nameVal = agentNames[slug] ?? userAgentName ?? "";
            return (
              <div className="flex items-center gap-3 rounded-lg border border-slate-800/70 bg-slate-950/30 p-3">
                <PixelAvatar seed={seed} size={56} />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nameVal}
                      onChange={(e) => setAgentNames(prev => ({ ...prev, [slug]: e.target.value }))}
                      maxLength={64}
                      placeholder="Agent name"
                      className="flex-1 px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => saveAgentName(slug, agentNames[slug] ?? userAgentName ?? "")}
                      disabled={agentNameSaving === slug}
                      className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-medium"
                    >Save</button>
                    {agentNameSavedSlug === slug && <span className="text-xs text-emerald-400">Saved</span>}
                  </div>
                  <button
                    onClick={() => rerollAgent(slug)}
                    disabled={agentSaving === slug}
                    className="px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-medium"
                  >🎲 Re-roll avatar</button>
                </div>
              </div>
            );
          })()}
        </section>
      ) : isAdmin && (
        <section className="mb-6 space-y-4 bg-slate-900/40 border border-slate-800/60 rounded-xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Agent avatars & names</h2>
          <p className="text-xs text-slate-500 -mt-2">Re-roll the pixel-art and rename each agent. Shows in their chat bubbles everywhere.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {AGENTS.filter(a => username === "nathan" ? (a.slug !== "mia" && a.slug !== "switchboard") : true).map(a => {
              const seed = agentSeeds[a.slug] || agentAvatarSeed(a.slug);
              const nameVal = agentNames[a.slug] ?? a.name;
              return (
                <div key={a.slug} className="flex items-center gap-3 rounded-lg border border-slate-800/70 bg-slate-950/30 p-3">
                  <PixelAvatar seed={seed} size={48} />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={nameVal}
                        onChange={(e) => setAgentNames(prev => ({ ...prev, [a.slug]: e.target.value }))}
                        maxLength={64}
                        className="flex-1 px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                        placeholder={a.name}
                      />
                      <button
                        onClick={() => saveAgentName(a.slug, agentNames[a.slug] ?? "")}
                        disabled={agentNameSaving === a.slug}
                        className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-medium"
                      >Save</button>
                      {agentNameSavedSlug === a.slug && <span className="text-xs text-emerald-400">Saved</span>}
                    </div>
                    <button
                      onClick={() => rerollAgent(a.slug)}
                      disabled={agentSaving === a.slug}
                      className="px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-medium"
                    >🎲 Re-roll avatar</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Legacy Branding section (brand-name + logoDataUrl POST /api/branding)
          superseded by <BrandingPanel /> mounted at top of page. */}

      {isAdmin && (
        <section className="mb-6 space-y-3 bg-slate-900/40 border border-slate-800/60 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Updates</h2>
            <button
              onClick={checkUpdates}
              disabled={updateChecking || updateDeploying}
              className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50"
            >{updateChecking ? "Checking…" : "Check again"}</button>
          </div>
          {updateInfo ? (
            <div className="text-xs text-slate-400 space-y-2">
              <div>
                Branch <code className="text-slate-200">{updateInfo.branch}</code> · local <code className="text-slate-200">{updateInfo.head}</code> · remote <code className="text-slate-200">{updateInfo.remote}</code>
              </div>
              {updateInfo.behind === 0 ? (
                <p className="text-emerald-400">Up to date.</p>
              ) : (
                <>
                  <p className="text-amber-300">{updateInfo.behind} commit{updateInfo.behind === 1 ? "" : "s"} behind:</p>
                  <ul className="font-mono text-[11px] text-slate-300 max-h-40 overflow-y-auto bg-slate-950/40 rounded-md border border-slate-800 p-2">
                    {updateInfo.commits.map((c) => (
                      <li key={c} className="truncate">{c}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Checking…</p>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={deployUpdates}
              disabled={updateDeploying || updateChecking || !updateInfo || updateInfo.behind === 0}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium"
            >
              {updateDeploying ? "Deploying…" : "Pull & rebuild"}
            </button>
            {updateMsg && (
              <span className={`text-xs whitespace-pre-wrap ${updateMsg.kind === "ok" ? "text-emerald-400" : "text-red-400"}`}>{updateMsg.text}</span>
            )}
          </div>
          {waitingForRestart && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm text-center space-y-3">
                <div className="text-2xl">⏳</div>
                <h3 className="text-base font-semibold text-slate-100">Restarting Mission Control</h3>
                <p className="text-xs text-slate-400">The dashboard is unavailable for a few seconds while the new build comes up. This page will reload automatically.</p>
                <p className="text-xs text-slate-500">Don&apos;t close this tab.</p>
              </div>
            </div>
          )}
        </section>
      )}

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
              {pending.map((u) => {
                const roleRow = roleRows.find((r) => r.id === u.id);
                return (
                  <li key={u.id} className="py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 truncate">
                        {u.username}
                        {u.justApproved && <span className="ml-2 text-[10px] text-emerald-400 uppercase tracking-wider">approved</span>}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{u.email}</div>
                      <div className="text-[11px] text-slate-600">{new Date(u.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {u.justApproved ? (
                        <select
                          value={roleRow?.role ?? "staff"}
                          disabled={roleBusy === u.id}
                          onChange={(e) => changeRole(u.id, e.target.value as Role)}
                          className="px-2 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-200 text-xs"
                        >
                          <option value="admin">Admin</option>
                          <option value="staff">Staff</option>
                          <option value="client">Client</option>
                        </select>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
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
                    onChange={(e) => changeRole(u.id, e.target.value as Role)}
                    className="px-2 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-200 text-xs"
                  >
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                    <option value="client">Client</option>
                  </select>
                </li>
              ))}
            </ul>
          )}
          {roleErr && <p className="text-xs text-red-400">{roleErr}</p>}
        </section>
      )}

      <section className="mb-6 space-y-3 bg-slate-900/40 border border-slate-800/60 rounded-xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Presets</h2>
        <p className="text-xs text-slate-500 -mt-1">Pick a starting palette. You can still tweak individual colours below.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => setTheme(p.theme)}
              className="flex items-center gap-2 rounded-lg border border-slate-800/70 bg-slate-950/30 hover:border-slate-600 p-2 text-left"
            >
              <div className="flex gap-0.5">
                <span className="h-7 w-2.5 rounded-sm" style={{ background: p.theme.dashboardBg }} />
                <span className="h-7 w-2.5 rounded-sm" style={{ background: p.theme.sidebarBg }} />
                <span className="h-7 w-2.5 rounded-sm" style={{ background: p.theme.userBubbleBg }} />
                <span className="h-7 w-2.5 rounded-sm" style={{ background: p.theme.agentBubbleBg }} />
              </div>
              <span className="text-xs text-slate-200">{p.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4 bg-slate-900/40 border border-slate-800/60 rounded-xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Theme colours</h2>
        {FIELDS.map(({ key, label, hint }) => (
          <div key={key} className="rounded-lg border border-slate-800/70 bg-slate-950/20 p-3 md:border-0 md:bg-transparent md:p-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={`${label} — open colour picker`}
                onClick={() => setOpenPicker(openPicker === key ? null : key)}
                style={{ backgroundColor: theme[key] }}
                className="h-14 w-14 shrink-0 cursor-pointer rounded-lg border border-slate-700 md:h-10 md:w-14"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm">{label}</div>
                {hint && <div className="text-xs text-slate-500">{hint}</div>}
              </div>
              <input
                type="text"
                inputMode="text"
                spellCheck={false}
                value={theme[key]}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  update(key, v.startsWith("#") ? v : `#${v}`);
                }}
                className="w-24 shrink-0 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-slate-500"
              />
            </div>
            {openPicker === key && (
              <div className="mt-3 flex justify-center">
                <HexColorPicker
                  color={theme[key]}
                  onChange={(c) => update(key, c)}
                  style={{ width: "100%", maxWidth: 280, height: 220 }}
                />
              </div>
            )}
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
