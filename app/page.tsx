"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TrophyShelf from "./components/TrophyShelf";

const T = {
  pageBg:        "var(--bento-page-bg, #0a0a0a)",
  cardBg:        "var(--bento-card-bg, #131313)",
  border:        "var(--bento-border, #262626)",
  borderSoft:    "var(--bento-border-soft, rgba(255,255,255,0.08))",
  accent:        "var(--bento-accent, #818cf8)",
  textPrimary:   "var(--bento-text-primary, #fafafa)",
  textSecondary: "var(--bento-text-secondary, #a0a0a0)",
  textMuted:     "var(--bento-text-muted, rgba(255,255,255,0.4))",
};

interface Task { id: string; text: string; priority: string; done: boolean }
interface ProjectModule { id: string; title: string; accent: string; tasks: Task[] }

interface MeUser {
  id: string;
  username: string;
  email: string;
  isAdmin?: boolean;
  agentName?: string | null;
}

type StreakState = { lastVisitYmd: string; streakDays: number };

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Working late";
}

const cardStyle: React.CSSProperties = {
  background: T.cardBg,
  border: `1px solid ${T.border}`,
  borderRadius: 20,
  padding: 20,
  color: T.textPrimary,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: T.textMuted }}>
        {label}
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1.1 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 12, color: T.textSecondary }}>{hint}</div>}
    </div>
  );
}

function QuickLink({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link href={href} style={{ ...cardStyle, textDecoration: "none", cursor: "pointer", transition: "transform 0.15s" }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary }}>{title}</div>
      <div style={{ fontSize: 12, color: T.textSecondary }}>{subtitle}</div>
    </Link>
  );
}

export default function HomePage() {
  const [me, setMe] = useState<MeUser | null>(null);
  const [modules, setModules] = useState<ProjectModule[] | null>(null);
  const [streak, setStreak] = useState<StreakState>({ lastVisitYmd: "", streakDays: 0 });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/me/streak", { method: "POST", cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (alive && j?.ok && j.streak) setStreak(j.streak);
        }
      } catch {}
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (alive && j?.ok) setMe(j.user);
        }
      } catch {}
      try {
        const r = await fetch("/api/bento-modules", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (alive && Array.isArray(j)) setModules(j);
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  const taskStats = useMemo(() => {
    if (!modules) return { done: 0, open: 0, total: 0, projects: 0 };
    let done = 0, open = 0;
    for (const m of modules) {
      for (const t of m.tasks) (t.done ? done++ : open++);
    }
    return { done, open, total: done + open, projects: modules.length };
  }, [modules]);

  const displayName = me?.username
    ? me.username.charAt(0).toUpperCase() + me.username.slice(1)
    : "there";
  const agentName = me?.agentName || "your agent";

  return (
    <div style={{ minHeight: "100vh", background: T.pageBg, padding: "32px 20px 80px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

        <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
            {greeting()}
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: T.textPrimary, letterSpacing: "-0.5px", margin: 0 }}>
            {displayName}
          </h1>
          <p style={{ fontSize: 14, color: T.textSecondary, margin: 0 }}>
            {agentName !== "your agent"
              ? `${agentName} is ready when you are.`
              : "Your agent is ready when you are."}
          </p>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <StatCard
            label="Streak"
            value={streak.streakDays > 0 ? `${streak.streakDays}🔥` : "—"}
            hint={streak.streakDays > 0 ? `${streak.streakDays} day${streak.streakDays === 1 ? "" : "s"} in a row` : "Open MC tomorrow to start"}
          />
          <StatCard
            label="Tasks shipped"
            value={modules ? taskStats.done : "…"}
            hint={modules ? `across ${taskStats.projects} project${taskStats.projects === 1 ? "" : "s"}` : "loading"}
          />
          <StatCard
            label="Open tasks"
            value={modules ? taskStats.open : "…"}
            hint={modules ? "still on the board" : "loading"}
          />
        </section>

        <TrophyShelf />

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <QuickLink href="/agents"  title="Chat with your agent →" subtitle={`Open ${agentName}`} />
          <QuickLink href="/projects" title="Projects board →"        subtitle={`${taskStats.projects} project module${taskStats.projects === 1 ? "" : "s"}`} />
          <QuickLink href="/todo"     title="To-do list →"             subtitle="Personal tasks" />
          <QuickLink href="/wiki"     title="Wiki →"                   subtitle="Shared knowledge base" />
        </section>

        {me?.isAdmin && (
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <QuickLink href="/metrics"       title="Metrics →"        subtitle="Brand performance" />
            <QuickLink href="/daily-runs"    title="Daily runs →"     subtitle="Scheduled jobs" />
            <QuickLink href="/social-review" title="Social review →"  subtitle="Posts awaiting approval" />
            <QuickLink href="/reporting"     title="Reporting →"      subtitle="Reports & schedules" />
          </section>
        )}

      </div>
    </div>
  );
}
