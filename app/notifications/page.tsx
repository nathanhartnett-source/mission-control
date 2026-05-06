"use client";

import { useEffect, useState } from "react";

interface EventDef {
  type: string;
  label: string;
  description: string;
  default_enabled: boolean;
  default_severity: "critical" | "warn" | "info" | "success";
}

interface Settings {
  toggles: Record<string, boolean>;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  quiet_hours_critical_bypass?: boolean;
}

interface HistoryEvent {
  source: string;
  type: string;
  severity: "critical" | "warn" | "info" | "success";
  title: string;
  message?: string;
  log_tail?: string;
  context?: Record<string, unknown>;
  received_at?: string;
}

const sevColour: Record<string, string> = {
  critical: "text-rose-300 bg-rose-950/40 border-rose-800/50",
  warn:     "text-amber-300 bg-amber-950/40 border-amber-800/50",
  info:     "text-sky-300 bg-sky-950/40 border-sky-800/50",
  success:  "text-emerald-300 bg-emerald-950/40 border-emerald-800/50",
};
const sevEmoji: Record<string, string> = {
  critical: "🚨",
  warn: "⚠️",
  info: "📋",
  success: "✅",
};

export default function NotificationsPage() {
  const [eventDefs, setEventDefs] = useState<EventDef[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/alerts/settings");
      const j = await r.json();
      setEventDefs(j.event_defs);
      setSettings(j.settings);
      const h = await fetch("/api/alerts?limit=50");
      const hj = await h.json();
      setHistory(hj.history || []);
    })();
  }, []);

  const toggle = (type: string) => {
    if (!settings) return;
    const toggles = { ...settings.toggles, [type]: !(settings.toggles[type] ?? true) };
    setSettings({ ...settings, toggles });
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const r = await fetch("/api/alerts/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (r.ok) setSavedAt(new Date().toLocaleTimeString());
    setSaving(false);
  };

  const fireTest = async () => {
    const r = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "mc-notifications-ui",
        type: "cron.social-11am.failure",
        severity: "critical",
        title: "Test alert from mc Notifications panel",
        message: "This is a test alert fired manually.",
        log_tail: "[test] simulated log tail\n[test] nothing actually broke",
        context: { brand: "test", fired_by: "mc-ui" },
      }),
    });
    const j = await r.json();
    alert(j.ok
      ? `Sent. Discord posted: ${j.discord_posted_ok ? "yes ✅" : "no ❌"}  enabled=${j.enabled}  quiet=${j.quiet_hours_skipped}`
      : `Failed: ${j.error}`);
    // refresh history
    const h = await fetch("/api/alerts?limit=50"); const hj = await h.json();
    setHistory(hj.history || []);
  };

  if (!settings) {
    return <div className="p-6 text-slate-300">Loading…</div>;
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto text-slate-200 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-[var(--font-space)] font-semibold">Notifications</h1>
        <p className="text-slate-400">
          Choose which alerts send to Discord (which pushes to your phone). Scripts POST events to{" "}
          <code className="text-sky-300">/api/alerts</code>; this page decides what gets through.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Event types</h2>
          <button
            onClick={fireTest}
            className="text-xs px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700"
          >
            Fire test alert
          </button>
        </div>
        <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
          {eventDefs.map((e) => {
            const on = settings.toggles[e.type] ?? e.default_enabled;
            return (
              <div key={e.type} className="flex items-start gap-4 p-4 bg-slate-900/60">
                <button
                  onClick={() => toggle(e.type)}
                  className={`mt-1 w-10 h-6 rounded-full relative transition ${on ? "bg-emerald-500" : "bg-slate-700"}`}
                  aria-label={`Toggle ${e.label}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${on ? "left-4" : "left-0.5"}`}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{e.label}</span>
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border ${sevColour[e.default_severity]}`}>
                      {e.default_severity}
                    </span>
                  </div>
                  <div className="text-sm text-slate-400 mt-0.5">{e.description}</div>
                  <div className="text-[11px] text-slate-600 font-mono mt-0.5">{e.type}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Quiet hours <span className="text-sm text-slate-500">(Australia/Sydney)</span></h2>
        <div className="flex flex-wrap gap-4 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider">Start</span>
            <input
              type="time"
              value={settings.quiet_hours_start || ""}
              onChange={(e) => setSettings({ ...settings, quiet_hours_start: e.target.value })}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider">End</span>
            <input
              type="time"
              value={settings.quiet_hours_end || ""}
              onChange={(e) => setSettings({ ...settings, quiet_hours_end: e.target.value })}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={settings.quiet_hours_critical_bypass !== false}
              onChange={(e) => setSettings({ ...settings, quiet_hours_critical_bypass: e.target.checked })}
              className="accent-emerald-500"
            />
            Critical alerts bypass quiet hours
          </label>
        </div>
        <p className="text-xs text-slate-500">Leave blank to disable quiet hours entirely.</p>
      </section>

      <section className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-sm disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {savedAt && <span className="text-xs text-emerald-400">Saved at {savedAt}</span>}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Recent alerts <span className="text-sm text-slate-500">({history.length})</span></h2>
        {history.length === 0 && <p className="text-slate-500 text-sm">Nothing yet — fire a test alert above to check plumbing.</p>}
        <div className="space-y-2">
          {history.slice().reverse().map((h, i) => (
            <div key={i} className={`border rounded-lg p-3 ${sevColour[h.severity] || "border-slate-800 bg-slate-900/60 text-slate-300"}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{sevEmoji[h.severity]} {h.title}</span>
                <span className="text-[11px] text-slate-500 font-mono">{h.received_at?.slice(0, 19).replace("T", " ")}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-500 mt-0.5">{h.type} · {h.source}</div>
              {h.message && <div className="text-sm text-slate-300 mt-1">{h.message}</div>}
              {h.log_tail && (
                <pre className="mt-2 text-[11px] bg-slate-950/70 border border-slate-800 rounded p-2 overflow-x-auto whitespace-pre-wrap">{h.log_tail.slice(0, 1200)}</pre>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
