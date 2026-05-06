"use client";

/**
 * Pixel-art office scene. Each achievement id maps to a fixed slot on the wall
 * or desk; locked items render as faint silhouettes so the desk fills in as
 * the user earns badges. Designed for the full 17-achievement catalog so the
 * final scene reads as a furnished office, not a sparse grid.
 *
 * Coordinate system: 320 × 180 viewBox, scaled responsively by the parent.
 */

import { useMemo } from "react";

type Tier = "bronze" | "silver" | "gold" | "platinum";

const TIER_FILL: Record<Tier, string> = {
  bronze:   "#c98b4a",
  silver:   "#d8dde3",
  gold:     "#f5cb3c",
  platinum: "#b8d3ff",
};
const TIER_DARK: Record<Tier, string> = {
  bronze:   "#7a4f24",
  silver:   "#8a8f96",
  gold:     "#a8841f",
  platinum: "#6a85b8",
};

type Slot = {
  id: string;
  /** Render the item when unlocked. (x,y) is the slot's top-left in viewBox units. */
  draw: (locked: boolean) => React.ReactNode;
};

/** Tiny trophy cup: bowl + stem + base, 14×18. */
function TrophyCup({ x, y, tier, scale = 1 }: { x: number; y: number; tier: Tier; scale?: number }) {
  const f = TIER_FILL[tier];
  const d = TIER_DARK[tier];
  const w = 12 * scale;
  const h = 16 * scale;
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {/* handles */}
      <rect x={-2} y={3} width={2} height={5} fill={d} />
      <rect x={12} y={3} width={2} height={5} fill={d} />
      {/* bowl */}
      <rect x={1} y={1} width={10} height={8} fill={f} />
      <rect x={1} y={1} width={10} height={1} fill={d} />
      <rect x={1} y={8} width={10} height={1} fill={d} />
      {/* stem */}
      <rect x={5} y={9} width={2} height={3} fill={d} />
      {/* base */}
      <rect x={2} y={12} width={8} height={2} fill={f} />
      <rect x={2} y={14} width={8} height={1} fill={d} />
    </g>
  );
}

/** Framed certificate: brown frame + cream paper + ribbon. 18×14 */
function Certificate({ x, y, tier }: { x: number; y: number; tier: Tier }) {
  const f = TIER_FILL[tier];
  const d = TIER_DARK[tier];
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={20} height={15} fill="#5a3a20" />
      <rect x={1} y={1} width={18} height={13} fill="#f1e4c2" />
      <rect x={3} y={3} width={14} height={1} fill="#9a7a40" />
      <rect x={3} y={5} width={11} height={1} fill="#9a7a40" />
      <rect x={3} y={7} width={13} height={1} fill="#9a7a40" />
      {/* ribbon seal */}
      <rect x={14} y={9} width={3} height={3} fill={f} />
      <rect x={13} y={12} width={1} height={2} fill={d} />
      <rect x={17} y={12} width={1} height={2} fill={d} />
    </g>
  );
}

/** Triangular streak pennant on a string. 12×16 */
function Pennant({ x, y, tier }: { x: number; y: number; tier: Tier }) {
  const f = TIER_FILL[tier];
  const d = TIER_DARK[tier];
  return (
    <g transform={`translate(${x},${y})`}>
      {/* string attachment */}
      <rect x={5} y={0} width={1} height={2} fill="#3a2e2a" />
      {/* pennant flag (pointing down-right) */}
      <polygon points="0,2 12,2 6,14" fill={f} />
      <polygon points="0,2 12,2 11,3 1,3" fill={d} opacity="0.4" />
      {/* flame icon */}
      <rect x={5} y={5} width={2} height={3} fill="#fff" opacity={0.7} />
    </g>
  );
}

/** Pen in pen-holder. Each pen is 1×8. 3 slots in a 8×10 cup. */
function PenIn({ x, y, tier, slot }: { x: number; y: number; tier: Tier; slot: 0 | 1 | 2 }) {
  const f = TIER_FILL[tier];
  const d = TIER_DARK[tier];
  const px = x + 2 + slot * 2;
  const py = y - 6;
  return (
    <g>
      <rect x={px} y={py} width={1} height={6} fill={f} />
      <rect x={px} y={py} width={1} height={1} fill={d} />
    </g>
  );
}

/** Model ship of escalating size on desk. 14-22 wide. */
function Ship({ x, y, tier }: { x: number; y: number; tier: Tier }) {
  const f = TIER_FILL[tier];
  const d = TIER_DARK[tier];
  const sz = tier === "bronze" ? 12 : tier === "silver" ? 16 : 20;
  const h = tier === "bronze" ? 8 : tier === "silver" ? 11 : 14;
  return (
    <g transform={`translate(${x},${y - h})`}>
      {/* hull */}
      <polygon points={`0,${h - 3} ${sz},${h - 3} ${sz - 2},${h} 2,${h}`} fill={d} />
      <rect x={1} y={h - 4} width={sz - 2} height={1} fill={f} />
      {/* mast */}
      <rect x={Math.floor(sz / 2)} y={0} width={1} height={h - 3} fill="#3a2e2a" />
      {/* sail */}
      <polygon points={`${Math.floor(sz / 2) + 1},1 ${Math.floor(sz / 2) + 1},${h - 4} ${sz - 1},${h - 4}`} fill="#f1e4c2" />
      <polygon points={`${Math.floor(sz / 2) - 1},1 ${Math.floor(sz / 2) - 1},${h - 4} 1,${h - 4}`} fill="#e0d2a8" />
    </g>
  );
}

/** Sparkle vanity mirror — Stylist badge. */
function VanityMirror({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx={5} cy={5} rx={5} ry={6} fill="#e7c8d8" />
      <ellipse cx={5} cy={5} rx={4} ry={5} fill="#fff" opacity={0.7} />
      <rect x={4} y={11} width={2} height={2} fill="#9a5a78" />
      <rect x={2} y={13} width={6} height={1} fill="#9a5a78" />
      {/* sparkle */}
      <rect x={3} y={3} width={1} height={1} fill="#fff" />
      <rect x={6} y={5} width={1} height={1} fill="#fff" />
    </g>
  );
}

/** ---- Slot configuration: fixed positions for the 17-achievement catalog. ---- */

const SLOTS: Slot[] = [
  // ── WALL SHELF — chat trophies (left half, ascending tier) ──
  { id: "chat-10",   draw: () => <TrophyCup x={20}  y={56} tier="bronze"   /> },
  { id: "chat-50",   draw: () => <TrophyCup x={42}  y={54} tier="silver"   /> },
  { id: "chat-250",  draw: () => <TrophyCup x={66}  y={52} tier="gold"     scale={1.1} /> },
  { id: "chat-1000", draw: () => <TrophyCup x={92}  y={49} tier="platinum" scale={1.25} /> },

  // ── WALL PENNANTS — streak (between shelf and window, hung from a string) ──
  { id: "streak-3",   draw: () => <Pennant x={130} y={14} tier="bronze"   /> },
  { id: "streak-7",   draw: () => <Pennant x={146} y={14} tier="silver"   /> },
  { id: "streak-30",  draw: () => <Pennant x={162} y={14} tier="gold"     /> },
  { id: "streak-100", draw: () => <Pennant x={178} y={14} tier="platinum" /> },

  // ── FRAMED CERTIFICATES — wiki (right of window, 2×2 grid) ──
  { id: "wiki-1",   draw: () => <Certificate x={222} y={82}  tier="bronze"   /> },
  { id: "wiki-10",  draw: () => <Certificate x={246} y={82}  tier="silver"   /> },
  { id: "wiki-50",  draw: () => <Certificate x={270} y={82}  tier="gold"     /> },
  { id: "wiki-200", draw: () => <Certificate x={294} y={82}  tier="platinum" /> },

  // ── DESK: PEN HOLDER — agent training ──
  { id: "train-1",  draw: () => <PenIn x={134} y={120} tier="bronze" slot={0} /> },
  { id: "train-10", draw: () => <PenIn x={134} y={120} tier="silver" slot={1} /> },
  { id: "train-50", draw: () => <PenIn x={134} y={120} tier="gold"   slot={2} /> },

  // ── DESK: MODEL SHIPS — tasks shipped (right side of desk) ──
  { id: "ship-5",   draw: () => <Ship x={170} y={120} tier="bronze"   /> },
  { id: "ship-25",  draw: () => <Ship x={188} y={120} tier="silver"   /> },
  { id: "ship-100", draw: () => <Ship x={210} y={120} tier="gold"     /> },

  // ── DESK: VANITY MIRROR — stylist ──
  { id: "style-1",  draw: () => <VanityMirror x={240} y={108} /> },
];

export default function PixelOffice({ awardedIds }: { awardedIds: string[] }) {
  const have = useMemo(() => new Set(awardedIds), [awardedIds]);

  return (
    <div style={{ width: "100%", borderRadius: 14, overflow: "hidden", background: "#1a1418", border: "1px solid #2a2226" }}>
      <svg
        viewBox="0 0 320 180"
        width="100%"
        style={{ display: "block", imageRendering: "pixelated" }}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Your pixel-art office. Trophies and awards appear here as you earn them."
      >
        {/* ---------- Background — STARTER CUBICLE (humble, upgrade later) ---------- */}
        {/* Back partition wall — beige fabric */}
        <rect x={0} y={0} width={320} height={120} fill="#a89a82" />
        {/* fabric weave dots */}
        {Array.from({ length: 40 }).map((_, i) => {
          const fx = (i * 17) % 320;
          const fy = (i * 11) % 118;
          return <rect key={`w${i}`} x={fx} y={fy} width={1} height={1} fill="#8a7d68" opacity={0.4} />;
        })}
        {/* Partition trim */}
        <rect x={0} y={116} width={320} height={2} fill="#5a4f3e" />
        <rect x={0} y={118} width={320} height={2} fill="#3a3128" />
        {/* Grey carpet floor */}
        <rect x={0} y={120} width={320} height={60} fill="#4a4845" />
        <rect x={0} y={120} width={320} height={1} fill="#5a5855" />
        {/* carpet specks */}
        {Array.from({ length: 30 }).map((_, i) => {
          const fx = (i * 23) % 320;
          const fy = 122 + ((i * 7) % 56);
          return <rect key={`c${i}`} x={fx} y={fy} width={1} height={1} fill="#3a3835" />;
        })}

        {/* No window in cubicle — just a small motivational poster (placeholder, ungated) */}
        <rect x={222} y={20} width={50}  height={36} fill="#2a2226" />
        <rect x={224} y={22} width={46}  height={32} fill="#e8e0d0" />
        <rect x={228} y={28} width={38}  height={2}  fill="#9a8068" />
        <rect x={228} y={34} width={30}  height={1}  fill="#9a8068" />
        <rect x={228} y={38} width={34}  height={1}  fill="#9a8068" />
        <rect x={228} y={42} width={24}  height={1}  fill="#9a8068" />

        {/* Wall shelf (under trophies) — plain particleboard */}
        <rect x={14}  y={68} width={108} height={2} fill="#3a3128" />
        <rect x={14}  y={70} width={108} height={1} fill="#2a221c" opacity={0.5} />

        {/* Pennant string */}
        <line x1={128} y1={14} x2={196} y2={14} stroke="#3a3128" strokeWidth={0.5} />

        {/* ---------- Desk — basic grey laminate ---------- */}
        <rect x={10}  y={118} width={300} height={6}  fill="#787470" />
        <rect x={10}  y={118} width={300} height={1}  fill="#9a958f" />
        <rect x={10}  y={123} width={300} height={1}  fill="#4a4845" />
        {/* Desk drawer block (left) — plain */}
        <rect x={20}  y={124} width={50}  height={36} fill="#6a6660" />
        <rect x={22}  y={130} width={46}  height={1}  fill="#4a4845" />
        <rect x={22}  y={144} width={46}  height={1}  fill="#4a4845" />
        <rect x={42}  y={134} width={6}   height={1}  fill="#9a958f" />
        <rect x={42}  y={148} width={6}   height={1}  fill="#9a958f" />
        {/* Desk legs */}
        <rect x={290} y={124} width={4}   height={50} fill="#6a6660" />

        {/* Boxy old monitor — the agent */}
        <rect x={80}  y={88}  width={44}  height={28} fill="#3a3835" />
        <rect x={82}  y={90}  width={40}  height={24} fill="#2a3a4a" />
        <rect x={84}  y={92}  width={36}  height={2}  fill="#4a6a8a" opacity={0.6} />
        <rect x={84}  y={96}  width={20}  height={1}  fill="#7a99b8" opacity={0.6} />
        <rect x={84}  y={99}  width={28}  height={1}  fill="#7a99b8" opacity={0.5} />
        <rect x={84}  y={102} width={16}  height={1}  fill="#7a99b8" opacity={0.5} />
        <rect x={100} y={116} width={4}   height={2}  fill="#3a3835" />
        <rect x={94}  y={117} width={16}  height={1}  fill="#3a3835" />

        {/* Pen holder cup — cheap plastic */}
        <rect x={132} y={110} width={10}  height={8}  fill="#3a3835" />
        <rect x={132} y={110} width={10}  height={1}  fill="#5a5855" />

        {/* Plain ceramic mug */}
        <rect x={148} y={111} width={8}   height={7}  fill="#c8c4be" />
        <rect x={156} y={113} width={2}   height={3}  fill="#c8c4be" />
        <rect x={149} y={112} width={6}   height={1}  fill="#5a5855" />

        {/* Cheap office chair (in front of desk) */}
        <rect x={140} y={146} width={26}  height={4}  fill="#2a2226" />
        <rect x={140} y={130} width={4}   height={20} fill="#2a2226" />
        <rect x={144} y={130} width={22}  height={2}  fill="#2a2226" />
        <rect x={154} y={150} width={2}   height={16} fill="#2a2226" />
        <rect x={146} y={166} width={18}  height={2}  fill="#2a2226" />

        {/* ---------- Achievement slots ---------- */}
        {SLOTS.map((s) => {
          const unlocked = have.has(s.id);
          return (
            <g
              key={s.id}
              opacity={unlocked ? 1 : 0.13}
              style={{ transition: "opacity 600ms ease" }}
            >
              {s.draw(!unlocked)}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
