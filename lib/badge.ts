/**
 * Pixel-art badge / trophy SVG generator. Deterministic from achievement id;
 * tier picks the metal palette, glyph picks the inner symbol.
 */
import type { Achievement } from "./achievements";

const TIERS: Record<Achievement["tier"], { rim: string; face: string; shine: string; ribbon: string }> = {
  bronze:   { rim: "#7a3e1d", face: "#c87533", shine: "#f0a85b", ribbon: "#5b3a1e" },
  silver:   { rim: "#5a6470", face: "#b9c2cc", shine: "#e7ecf2", ribbon: "#3a4250" },
  gold:     { rim: "#8a6a00", face: "#e6b800", shine: "#fff0a8", ribbon: "#6a4a00" },
  platinum: { rim: "#4a5a8a", face: "#9fb6e0", shine: "#dde7fb", ribbon: "#2a3a6a" },
};

type Glyph = Achievement["glyph"];

// 7×7 monochrome glyph mask; '.' = empty, '#' = on.
const GLYPHS: Record<Glyph, string[]> = {
  chat: [
    ".#####.",
    "#######",
    "#######",
    "#######",
    ".#####.",
    "..##...",
    ".#.....",
  ],
  scroll: [
    ".#####.",
    "#.....#",
    "#.###.#",
    "#.....#",
    "#.###.#",
    "#.....#",
    ".#####.",
  ],
  flame: [
    "...#...",
    "..###..",
    ".#.#.#.",
    "#..#..#",
    "#.###.#",
    ".#####.",
    "..###..",
  ],
  brain: [
    ".#####.",
    "##.#.##",
    "#.###.#",
    "##.#.##",
    "#.###.#",
    "##.#.##",
    ".#####.",
  ],
  ship: [
    "...#...",
    "..###..",
    ".#####.",
    "#######",
    "#.....#",
    ".#####.",
    "..###..",
  ],
  sparkle: [
    "...#...",
    ".#.#.#.",
    "..###..",
    "#######",
    "..###..",
    ".#.#.#.",
    "...#...",
  ],
};

export function badgeSvg(a: Achievement, size: number = 96): string {
  const t = TIERS[a.tier];
  const g = GLYPHS[a.glyph];
  // 16×16 grid medal: ribbon top, round disc, glyph centred.
  const grid: (string | null)[][] = Array.from({ length: 16 }, () => Array<string | null>(16).fill(null));

  // Ribbon (rows 0-3) — two trailing tails
  for (let y = 0; y <= 2; y++) {
    grid[y][4] = t.ribbon; grid[y][5] = t.ribbon;
    grid[y][10] = t.ribbon; grid[y][11] = t.ribbon;
  }
  grid[3][5] = t.ribbon; grid[3][10] = t.ribbon;

  // Disc — circle approx, rows 3-14, cols 2-13
  const cx = 7.5, cy = 9.5, r = 5.6;
  for (let y = 3; y <= 15; y++) {
    for (let x = 1; x <= 14; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > r + 0.5) continue;
      if (d > r - 0.5) grid[y][x] = t.rim;
      else grid[y][x] = t.face;
    }
  }
  // Highlight crescent (top-left)
  for (let y = 4; y <= 7; y++) {
    for (let x = 3; x <= 6; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > r - 1 || d < r - 3) continue;
      if (grid[y][x] === t.face) grid[y][x] = t.shine;
    }
  }

  // Glyph (7×7 → centred at cols 4-10, rows 6-12)
  for (let gy = 0; gy < 7; gy++) {
    for (let gx = 0; gx < 7; gx++) {
      if (g[gy][gx] !== "#") continue;
      const x = 4 + gx, y = 6 + gy;
      // Only draw if inside the disc
      if (Math.hypot(x - cx, y - cy) <= r - 0.5) grid[y][x] = t.ribbon;
    }
  }

  const cell = size / 16;
  let rects = "";
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const c = grid[y][x];
      if (!c) continue;
      rects += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${c}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${rects}</svg>`;
}

export function badgeDataUri(a: Achievement, size: number = 96): string {
  const svg = badgeSvg(a, size);
  if (typeof Buffer !== "undefined") {
    return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  }
  const b64 = typeof btoa !== "undefined" ? btoa(unescape(encodeURIComponent(svg))) : svg;
  return `data:image/svg+xml;base64,${b64}`;
}
