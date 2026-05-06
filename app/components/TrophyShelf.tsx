"use client";

import { useEffect, useState } from "react";
import PixelOffice from "./PixelOffice";

type Award = {
  id: string;
  title: string;
  blurb: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  badge: string;
};
type Locked = {
  id: string;
  title: string;
  blurb: string;
  threshold: number;
  progress: number;
  tier: Award["tier"];
};

const TIER_GLOW: Record<Award["tier"], string> = {
  bronze:   "drop-shadow(0 0 6px rgba(240,168,91,0.45))",
  silver:   "drop-shadow(0 0 6px rgba(231,236,242,0.45))",
  gold:     "drop-shadow(0 0 8px rgba(255,230,0,0.55))",
  platinum: "drop-shadow(0 0 8px rgba(159,182,224,0.55))",
};

export default function TrophyShelf() {
  const [awarded, setAwarded] = useState<Award[]>([]);
  const [locked, setLocked] = useState<Locked[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/me/achievements", { cache: "no-store" });
        if (!alive || !r.ok) return;
        const j = await r.json();
        if (j?.ok) {
          setAwarded(Array.isArray(j.awarded) ? j.awarded : []);
          setLocked(Array.isArray(j.locked) ? j.locked : []);
        }
      } catch {} finally { if (alive) setLoaded(true); }
    })();
    return () => { alive = false; };
  }, []);

  if (!loaded) return null;

  // Show next 3 closest-to-unlock locked goals
  const upcoming = [...locked]
    .filter((l) => l.threshold > 0)
    .map((l) => ({ ...l, ratio: Math.min(1, l.progress / l.threshold) }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3);

  return (
    <section
      style={{
        background: "var(--bento-card-bg, #131313)",
        border: "1px solid var(--bento-border, #262626)",
        borderRadius: 20,
        padding: 20,
        color: "var(--bento-text-primary, #fafafa)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--bento-text-muted, rgba(255,255,255,0.4))" }}>
          Trophy Shelf
        </div>
        <div style={{ fontSize: 12, color: "var(--bento-text-secondary, #a0a0a0)" }}>
          {awarded.length} unlocked
        </div>
      </div>

      <PixelOffice awardedIds={awarded.map((a) => a.id)} />

      {awarded.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--bento-text-secondary, #a0a0a0)" }}>
          Your office is empty — chat with your agent, build the wiki, ship tasks. Trophies, certificates and pens fill in as you go.
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {awarded.map((a) => (
            <div key={a.id} title={`${a.title} — ${a.blurb}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 72 }}>
              <img src={a.badge} alt={a.title} width={48} height={48} style={{ imageRendering: "pixelated", filter: TIER_GLOW[a.tier] }} />
              <div style={{ fontSize: 10, fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>{a.title}</div>
            </div>
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--bento-text-muted, rgba(255,255,255,0.4))" }}>
            Up next
          </div>
          {upcoming.map((u) => (
            <div key={u.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>{u.title}</span>
                <span style={{ color: "var(--bento-text-secondary, #a0a0a0)" }}>{u.progress}/{u.threshold}</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.round(u.ratio * 100)}%`, background: "var(--bento-accent, #818cf8)", transition: "width 400ms ease" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
