"use client";

/**
 * Polls /api/me/achievements?mode=peek every 30s. New unlocks appear as a
 * big-then-fade overlay (badge + title + blurb). Click anywhere to dismiss.
 *
 * Other code can also surface unlocks immediately by dispatching:
 *   window.dispatchEvent(new CustomEvent("mc:achievement-check"))
 * which forces an out-of-cycle peek.
 */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const POLL_MS = 30_000;

type Award = {
  id: string;
  title: string;
  blurb: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  badge: string;
};

const TIER_GLOW: Record<Award["tier"], string> = {
  bronze:   "0 0 60px rgba(240,168,91,0.55)",
  silver:   "0 0 60px rgba(231,236,242,0.55)",
  gold:     "0 0 80px rgba(255,230,0,0.65)",
  platinum: "0 0 80px rgba(159,182,224,0.65)",
};

export default function AchievementOverlay() {
  const pathname = usePathname();
  const [queue, setQueue] = useState<Award[]>([]);
  const [shown, setShown] = useState<Award | null>(null);
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
  const polling = useRef(false);

  // Poll loop
  useEffect(() => {
    if (pathname.startsWith("/login") || pathname.startsWith("/register")) return;
    let alive = true;
    async function peek() {
      if (polling.current) return;
      polling.current = true;
      try {
        const r = await fetch("/api/me/achievements?mode=peek", { cache: "no-store" });
        if (!alive || !r.ok) return;
        const j = await r.json();
        const newly: Award[] = Array.isArray(j?.newly) ? j.newly : [];
        if (newly.length) setQueue((q) => [...q, ...newly]);
      } catch {} finally { polling.current = false; }
    }
    peek();
    const t = setInterval(peek, POLL_MS);
    const onCheck = () => peek();
    window.addEventListener("mc:achievement-check", onCheck);
    return () => { alive = false; clearInterval(t); window.removeEventListener("mc:achievement-check", onCheck); };
  }, [pathname]);

  // Drain queue → show one at a time, big-then-fade.
  useEffect(() => {
    if (shown || queue.length === 0) return;
    const next = queue[0];
    setQueue((q) => q.slice(1));
    setShown(next);
    setPhase("in");
    const t1 = setTimeout(() => setPhase("hold"), 400);
    const t2 = setTimeout(() => setPhase("out"), 2800);
    const t3 = setTimeout(() => setShown(null), 3400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [queue, shown]);

  if (!shown) return null;

  const opacity = phase === "out" ? 0 : 1;
  const scale = phase === "in" ? 0.6 : phase === "hold" ? 1 : 1.15;

  return (
    <div
      onClick={() => setShown(null)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: phase === "out" ? "rgba(0,0,0,0)" : "rgba(0,0,0,0.55)",
        transition: "background 600ms ease",
        cursor: "pointer",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          opacity,
          transform: `scale(${scale})`,
          transition: "opacity 500ms ease, transform 500ms cubic-bezier(0.18,0.89,0.32,1.28)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.65)",
          }}
        >
          Achievement unlocked
        </div>
        <img
          src={shown.badge}
          alt={shown.title}
          width={160}
          height={160}
          style={{
            imageRendering: "pixelated",
            filter: `drop-shadow(${TIER_GLOW[shown.tier]})`,
          }}
        />
        <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>
          {shown.title}
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)" }}>{shown.blurb}</div>
      </div>
    </div>
  );
}
