import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { writeBranding, type ThemeColors, THEME_KEYS } from "@/lib/branding";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function runClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const claudeBin = process.env.MC_CLAUDE_BIN || "/home/nathan/.npm-global/bin/claude";
    const child = spawn(claudeBin, ["-p", prompt, "--output-format", "text"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, IS_SANDBOX: "1", PATH: `/home/nathan/.npm-global/bin:${process.env.PATH || ""}` },
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.stderr.on("data", (d) => { err += d.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`claude exit ${code}: ${err}`));
      resolve(out);
    });
    setTimeout(() => { try { child.kill("SIGTERM"); } catch {} reject(new Error("claude -p timeout")); }, 110000);
  });
}

function extractJson(text: string): ThemeColors | null {
  // Find the largest {...} block (model sometimes wraps in code fence).
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]);
    const out: ThemeColors = {};
    for (const k of THEME_KEYS) {
      if (typeof obj[k] === "string" && /^#[0-9a-fA-F]{3,8}$/.test(obj[k])) {
        (out as Record<string, string>)[k] = obj[k];
      }
    }
    // Need at least bgApp + textApp to be useful.
    if (!out.bgApp || !out.textApp) return null;
    return out;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const user = findById(session.userId);
  if (!user || !user.isAdmin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const url = String(body?.url || "").trim();
  if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: "valid http(s) URL required" }, { status: 400 });

  const prompt = [
    `Visit ${url} (use WebFetch to read the HTML+CSS).`,
    `STEP 1 — Mode detection. Look at the body background and body text colour. Decide LIGHT (light bg + dark text) or DARK (dark bg + light text). The dashboard you produce MUST match. Light site → light dashboard. Dark site → dark dashboard. Never invert.`,
    `STEP 2 — Pull the brand's primary and accent colours from the logo, hero image, headers, buttons, and prominent imagery.`,
    `STEP 3 — Design a complete dashboard theme using ONLY those brand colours and AA-readable complements. Output every key. Each background has a paired text colour that MUST hit 4.5:1 contrast against it.`,
    ``,
    `Output ONE JSON object, no prose, no code fences. ALL keys required, all hex strings (#rrggbb):`,
    `  bgApp           — main page background (mode-matched)`,
    `  textApp         — body text on bgApp (≥4.5:1)`,
    `  bgSurface       — cards/panels (slightly different from bgApp: lighter on dark themes, slightly darker on light themes)`,
    `  textSurface     — text inside cards (≥4.5:1 vs bgSurface)`,
    `  bgSidebar       — sidebar nav (clearly distinct from bgApp)`,
    `  textSidebar     — text on sidebar (≥4.5:1)`,
    `  bgBubbleUser    — user chat bubble = brand primary at full opacity`,
    `  textBubbleUser  — text on user bubble (≥4.5:1; usually white or near-white if primary is saturated)`,
    `  bgBubbleAgent   — agent bubble (subtle tinted surface, NOT pure white/black)`,
    `  textBubbleAgent — text on agent bubble (≥4.5:1)`,
    `  bgComposer      — chat input background (between bgApp and bgSurface in brightness)`,
    `  textComposer    — text inside composer (≥4.5:1)`,
    `  textMuted       — captions, timestamps, placeholders (slightly faded but still ≥3:1)`,
    `  borderDefault   — strong divider colour`,
    `  borderSubtle    — soft divider colour`,
    `  accent          — link colour, secondary buttons (brand accent if distinct from primary; else primary)`,
    `  textOnAccent    — text on accent fills (≥4.5:1)`,
    ``,
    `Constraints:`,
    `  - mode MUST match the source site`,
    `  - text-on-bg pair contrast ≥4.5:1 for every background`,
    `  - no pure #000000 or #ffffff for backgrounds (use #0e1117 / #fbf8f4 style instead)`,
    `  - colours feel like ONE family — not random clashing hues`,
    ``,
    `Light example: {"bgApp":"#fbf7f2","textApp":"#1f1a14","bgSurface":"#f5ede0","textSurface":"#231d15","bgSidebar":"#efe6d4","textSidebar":"#1f1a14","bgBubbleUser":"#c8842e","textBubbleUser":"#ffffff","bgBubbleAgent":"#f5ede0","textBubbleAgent":"#1f1a14","bgComposer":"#f8f1e4","textComposer":"#1f1a14","textMuted":"#7c705e","borderDefault":"#d8c9a8","borderSubtle":"#e6d9bd","accent":"#c8842e","textOnAccent":"#ffffff"}`,
    `Dark example: {"bgApp":"#0f1419","textApp":"#e6edf3","bgSurface":"#161b22","textSurface":"#e6edf3","bgSidebar":"#0a0d12","textSidebar":"#cdd9e5","bgBubbleUser":"#1f6feb","textBubbleUser":"#ffffff","bgBubbleAgent":"#161b22","textBubbleAgent":"#e6edf3","bgComposer":"#13171c","textComposer":"#e6edf3","textMuted":"#7d8590","borderDefault":"#30363d","borderSubtle":"#21262d","accent":"#1f6feb","textOnAccent":"#ffffff"}`,
  ].join("\n");

  let raw: string;
  try {
    raw = await runClaude(prompt);
  } catch (e) {
    return NextResponse.json({ error: `subagent failed: ${(e as Error).message}` }, { status: 500 });
  }

  const theme = extractJson(raw);
  if (!theme) return NextResponse.json({ error: "could not parse theme JSON from agent output", raw }, { status: 502 });

  const next = writeBranding({ theme, sourceUrl: url });
  return NextResponse.json({ ok: true, branding: next, theme });
}
