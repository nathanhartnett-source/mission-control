/**
 * Deterministic pixel-art avatar generator (head & shoulders).
 * Same seed → same avatar, forever. Zero deps. Server- and client-safe
 * because it only uses Web Crypto subtle-free byte derivation.
 */

function bytesFromSeed(seed: string): number[] {
  // FNV-1a 64-ish stretched to 32 bytes by repeated mixing.
  // Stable across server/client; we don't need cryptographic strength here.
  let h1 = 0x811c9dc5 >>> 0;
  let h2 = 0xcbf29ce4 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i * 7), 0x100000001b3 & 0xffffffff) >>> 0;
  }
  const out: number[] = [];
  for (let i = 0; i < 32; i++) {
    h1 = Math.imul(h1 ^ (h2 + i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (h1 + i * 31), 0x01000193) >>> 0;
    out.push((h1 ^ (h2 >>> 8)) & 0xff);
  }
  return out;
}

const SKIN = ["#f5d7b3", "#e8b89a", "#c8956d", "#a8744b", "#8d5524", "#5d3920", "#f0c8a0", "#d4a373"];
const HAIR = ["#1a1a1a", "#3b2a1a", "#7a4a2a", "#b87333", "#d4af37", "#e8e8e8", "#5a3a2a", "#c93f1f", "#4a2c1a", "#9b6a3a"];
const SHIRT = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#6366f1", "#22c55e", "#f97316", "#06b6d4", "#a855f7"];
const BG = ["#1e293b", "#312e81", "#064e3b", "#7c2d12", "#581c87", "#831843", "#155e75", "#1e1b4b", "#374151", "#0c4a6e", "#3f1d38", "#172554"];
const EYE = ["#1a1a1a", "#2a4a8b", "#1a4a2a", "#5a3a1a", "#3a3a3a"];

type Cell = string | null;

function hairCells(style: number, hair: string): Array<[number, number, string]> {
  // Returns list of [x, y, color] cells to paint over/around the head.
  const cells: Array<[number, number, string]> = [];
  const add = (x: number, y: number) => cells.push([x, y, hair]);
  switch (style % 5) {
    case 0: // flat top
      for (let x = 3; x <= 8; x++) add(x, 2);
      add(3, 3); add(8, 3);
      break;
    case 1: // spiky
      add(4, 1); add(6, 1); add(8, 1);
      for (let x = 3; x <= 8; x++) add(x, 2);
      break;
    case 2: // curly / afro
      for (let x = 2; x <= 9; x++) add(x, 2);
      add(2, 3); add(9, 3);
      add(2, 4); add(9, 4);
      break;
    case 3: // long
      for (let x = 3; x <= 8; x++) add(x, 2);
      add(3, 3); add(8, 3);
      add(2, 4); add(9, 4);
      add(2, 5); add(9, 5);
      add(2, 6); add(9, 6);
      add(2, 7); add(9, 7);
      break;
    case 4: // side parted
      add(3, 2); add(4, 2); add(6, 2); add(7, 2); add(8, 2);
      add(3, 3);
      break;
  }
  return cells;
}

export function avatarSvg(seed: string, size: number = 80): string {
  const b = bytesFromSeed(seed || "default");
  const skin = SKIN[b[0] % SKIN.length];
  const hair = HAIR[b[1] % HAIR.length];
  const shirt = SHIRT[b[2] % SHIRT.length];
  const bg = BG[b[3] % BG.length];
  const eye = EYE[b[4] % EYE.length];
  const hairStyle = b[5] % 5;
  const mouthStyle = b[6] % 3;
  const eyeStyle = b[7] % 3;

  // 12x12 grid
  const grid: Cell[][] = Array.from({ length: 12 }, () => Array<Cell>(12).fill(null));

  // Head (rows 3-8)
  for (let y = 3; y <= 8; y++) {
    const inset = (y === 3 || y === 8) ? 1 : 0;
    for (let x = 3 + inset; x <= 8 - inset; x++) grid[y][x] = skin;
  }
  // Ears
  grid[6][2] = skin; grid[6][9] = skin;

  // Hair
  for (const [x, y, c] of hairCells(hairStyle, hair)) {
    if (y >= 0 && y < 12 && x >= 0 && x < 12) grid[y][x] = c;
  }

  // Eyes
  if (eyeStyle === 0) {
    grid[5][4] = eye; grid[5][7] = eye;
  } else if (eyeStyle === 1) {
    // wide
    grid[5][4] = eye; grid[5][5] = eye;
    grid[5][7] = eye; // asymmetric, slight wink
  } else {
    // narrow / squinty (line)
    grid[5][4] = eye; grid[5][7] = eye;
    grid[6][4] = eye; grid[6][7] = eye;
  }

  // Mouth
  if (mouthStyle === 0) { grid[7][5] = "#7a2c2c"; grid[7][6] = "#7a2c2c"; }
  else if (mouthStyle === 1) { grid[7][5] = "#7a2c2c"; }
  else { grid[7][4] = "#7a2c2c"; grid[7][5] = "#7a2c2c"; grid[7][6] = "#7a2c2c"; }

  // Neck (row 9)
  grid[9][5] = skin; grid[9][6] = skin;

  // Shoulders / shirt (rows 10-11)
  for (let x = 1; x <= 10; x++) { grid[10][x] = shirt; grid[11][x] = shirt; }
  // Round shoulder edges
  grid[10][1] = null; grid[10][10] = null;

  let rects = "";
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      const c = grid[y][x];
      if (!c) continue;
      rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 12 12" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet"><rect width="12" height="12" fill="${bg}"/>${rects}</svg>`;
}

export function avatarDataUri(seed: string, size: number = 80): string {
  const svg = avatarSvg(seed, size);
  // utf8 → base64 (Node + browsers via TextEncoder + btoa-shim)
  if (typeof Buffer !== "undefined") {
    return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  }
  // browser fallback
  const b64 = typeof btoa !== "undefined" ? btoa(unescape(encodeURIComponent(svg))) : svg;
  return `data:image/svg+xml;base64,${b64}`;
}

export function rollAvatarSeed(): string {
  // 8 random bytes hex — plenty of variety, short to store
  const arr = new Uint8Array(8);
  if (typeof crypto !== "undefined" && (crypto as Crypto).getRandomValues) {
    (crypto as Crypto).getRandomValues(arr);
  } else {
    for (let i = 0; i < 8; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Stable per-agent seed so every Ava/Mia/Ash bubble looks the same everywhere. */
export function agentAvatarSeed(agent: string): string {
  return `agent:${agent.toLowerCase()}`;
}
