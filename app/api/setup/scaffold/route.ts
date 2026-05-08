import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { readBranding, writeBranding } from "@/lib/branding";
import { getPreset, DEFAULT_PRESET_ID } from "@/lib/theme-presets";
import { writeInstallConfig } from "@/lib/install-config";
import { mcConfig } from "@/lib/mc-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Idempotent first-run scaffold:
 *   - creates ~/.claude/projects/-home-${user}/memory/  (if missing)
 *   - writes persona.md  (only if missing — never overwrite)
 *   - creates ~/wiki/  (if missing) + writes welcome.md and using-mission-control.md (only if missing)
 *   - creates ~/.claude/channels/user-${user}/inbox/
 *   - creates ~/wiki/_outbox/mc-agent/
 *   - creates the agent-chat history dir
 *   - writes branding.json with brand name + description if provided
 *   - writes data/install-complete marker
 */
export async function POST(req: NextRequest) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const user = findById(session.userId);
  if (!user || !user.isAdmin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  let body: { brandName?: string; brandDescription?: string; agentName?: string; seedWiki?: boolean; useExistingCC?: boolean; wikiPath?: string } = {};
  try { body = await req.json(); } catch {}
  const brandName = (body.brandName || "Mission Control").trim().slice(0, 64);
  const brandDescription = (body.brandDescription || "").trim().slice(0, 600);
  const agentName = (body.agentName || "Assistant").trim().slice(0, 32);
  const seedWiki = body.seedWiki !== false; // default true
  // useExistingCC=true (default) → preserve any existing persona.md.
  // useExistingCC=false → operator wants a brand-new persona; overwrite if present.
  const useExistingCC = body.useExistingCC !== false;

  const HOME = os.homedir();
  const username = user.username.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const created: string[] = [];
  const skipped: string[] = [];

  function ensureDir(p: string) {
    if (!fs.existsSync(p)) { fs.mkdirSync(p, { recursive: true }); created.push(p); }
    else skipped.push(p);
  }
  function writeIfMissing(p: string, content: string) {
    if (fs.existsSync(p)) { skipped.push(p); return false; }
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, "utf-8");
    created.push(p);
    return true;
  }

  // Memory dir + persona
  const memDir = path.join(HOME, ".claude", "projects", `-home-${username}`, "memory");
  ensureDir(memDir);
  const personaPath = path.join(memDir, "persona.md");
  const persona = `---
name: ${agentName}
description: ${brandName} assistant
type: persona
---

**Agent name:** ${agentName}

You are ${agentName}, the AI assistant for ${brandName}.

${brandDescription || "Help the operator with whatever they need — research, drafting, planning, summarising, and answering questions about their wiki and notes."}

Be direct, conversational, and helpful. When something is uncertain, say so.
`;
  if (useExistingCC) {
    writeIfMissing(personaPath, persona);
  } else {
    // Operator declined to reuse existing CC base — overwrite persona.
    fs.mkdirSync(path.dirname(personaPath), { recursive: true });
    fs.writeFileSync(personaPath, persona, "utf-8");
    created.push(personaPath + " (overwritten)");
  }

  // Wiki — operator may have picked an existing dir (e.g. ~/obt-wiki) in the wizard.
  // Validate input is absolute and reasonable, else fall back to ~/wiki.
  console.log(`[scaffold] received body.wikiPath=${JSON.stringify(body.wikiPath)}`);
  let wikiPath = path.join(HOME, "wiki");
  if (body.wikiPath && typeof body.wikiPath === "string") {
    const candidate = path.resolve(body.wikiPath.trim());
    // Must be absolute and not be an obvious system dir.
    const forbidden = ["/", "/etc", "/usr", "/bin", "/var", "/root", "/home"];
    if (path.isAbsolute(candidate) && !forbidden.includes(candidate)) {
      wikiPath = candidate;
      console.log(`[scaffold] using picked wikiPath=${wikiPath}`);
    } else {
      console.warn(`[scaffold] rejected wikiPath=${candidate} (forbidden=${forbidden.includes(candidate)}, abs=${path.isAbsolute(candidate)}); falling back to ${wikiPath}`);
    }
  } else {
    console.log(`[scaffold] no wikiPath provided, defaulting to ${wikiPath}`);
  }
  ensureDir(wikiPath);
  writeInstallConfig({ wikiRoot: wikiPath });
  if (seedWiki) {
    writeIfMissing(path.join(wikiPath, "welcome.md"), `# Welcome to ${brandName}\n\nThis is your wiki — a markdown knowledge base your AI assistant can read.\n\nDrop notes, references, project specs, anything you want ${agentName} to remember and use as context.\n\nFiles are plain \`.md\` — edit them in your editor of choice or via the Mission Control wiki tab.\n`);
    writeIfMissing(path.join(wikiPath, "using-mission-control.md"), `# Using Mission Control\n\n## Chat with your agent\n\nThe **Agents** tab is your primary way to talk to ${agentName}. Type a message, hit send. The reply streams back in chat.\n\n## Wiki\n\nAnything in this wiki is accessible to ${agentName} as context. Reference files by name and the agent can read them.\n\n## Settings\n\n- **Branding**: upload a logo, detect a theme from a website URL, or fine-tune individual colours.\n- **Personalise theme**: each user can override colours for their own browser without affecting anyone else.\n- **Avatar**: re-roll your pixel-art identity until you find one you like.\n\n## Adding more users\n\nFrom Settings → Pending approvals (admin only) you can approve registrations.\n`);
  }

  // Channels + outbox + history
  ensureDir(path.join(HOME, ".claude", "channels", `user-${username}`, "inbox"));
  ensureDir(path.join(HOME, "wiki", "_outbox", "mc-agent"));
  ensureDir(path.join(HOME, "legacy-workspace", "mission-control", "data", "agent-chat"));

  // Branding — persist the operator-provided brand name + apply Slate as
  // default theme if none set yet (no logo/URL detection during wizard).
  const cur = readBranding();
  const hasTheme = cur.theme && Object.keys(cur.theme).length > 0;
  const wantsBrandWrite = brandName && brandName !== "Mission Control";
  if (!hasTheme) {
    const slate = getPreset(DEFAULT_PRESET_ID);
    writeBranding({
      ...(slate ? { theme: slate.theme } : {}),
      ...(wantsBrandWrite ? { brandName } : {}),
    });
  } else if (wantsBrandWrite) {
    writeBranding({ brandName });
  }

  // Install-complete marker
  const markerPath = path.join(mcConfig.dataRoot, "install-complete");
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  if (!fs.existsSync(markerPath)) fs.writeFileSync(markerPath, new Date().toISOString(), "utf-8");

  return NextResponse.json({ ok: true, created, skipped, agentName, brandName });
}
