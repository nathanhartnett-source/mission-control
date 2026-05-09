/**
 * Per-user workspace provisioning. Called on approval.
 *
 * Creates:
 *  - ~/.claude/projects/-home-<username>/memory/         (auto-memory dir)
 *  - ~/.claude/projects/-home-<username>/memory/MEMORY.md (seed index)
 *  - ~/.claude/channels/user-<username>/inbox/           (per-user agent inbox)
 *  - ~/user-workspaces/<username>/                       (per-user agent cwd)
 *
 * Idempotent — safe to call again on a user that already has a workspace.
 */
import fs from "fs";
import path from "path";
import os from "os";

const HOME = os.homedir();

export type Persona = {
  agentName: string;
  tone: "concise" | "warm" | "dry-wit" | "professional" | "playful";
  emoji: boolean;
  formality: "casual" | "balanced" | "formal";
  aboutMe: string;
  goals: string;
  followUps: { question: string; answer: string }[];
};

export function memoryDir(username: string): string {
  return path.join(HOME, ".claude", "projects", `-home-${username}`, "memory");
}

export function inboxDir(username: string): string {
  return path.join(HOME, ".claude", "channels", `user-${username}`, "inbox");
}

export function userWorkspaceDir(username: string): string {
  return path.join(HOME, "user-workspaces", username);
}

export function provisionWorkspace(username: string): void {
  const u = username.toLowerCase();
  const mem = memoryDir(u);
  const inb = inboxDir(u);
  const ws = userWorkspaceDir(u);
  fs.mkdirSync(mem, { recursive: true });
  fs.mkdirSync(inb, { recursive: true });
  fs.mkdirSync(ws, { recursive: true });

  // Symlink claude -p's auto-memory dir (encoded from the workspace cwd) →
  // the canonical per-user memory dir, so persona.md is found every turn.
  const encoded = ws.split("/").join("-");
  const autoMemParent = path.join(HOME, ".claude", "projects", encoded);
  const autoMem = path.join(autoMemParent, "memory");
  try {
    fs.mkdirSync(autoMemParent, { recursive: true });
    if (!fs.existsSync(autoMem)) {
      fs.symlinkSync(mem, autoMem);
    }
  } catch { /* non-fatal */ }

  const memIndex = path.join(mem, "MEMORY.md");
  if (!fs.existsSync(memIndex)) {
    fs.writeFileSync(
      memIndex,
      `# Memory Index\n\n_New workspace for ${u}. Memories will be added here as they're saved._\n`,
      "utf8",
    );
  }
}

export function writePersona(username: string, persona: Persona): void {
  const u = username.toLowerCase();
  const display = u ? u[0].toUpperCase() + u.slice(1) : u;
  const mem = memoryDir(u);
  fs.mkdirSync(mem, { recursive: true });

  const file = path.join(mem, "persona.md");
  const body = `---
name: agent-persona
description: How this agent should behave for ${display} — set during onboarding.
type: feedback
---

# Agent persona for ${display}

**Agent name:** ${persona.agentName}
**Tone:** ${persona.tone}
**Emoji:** ${persona.emoji ? "yes" : "no"}
**Formality:** ${persona.formality}

## About the user
${persona.aboutMe || "_(not provided)_"}

## What they want from the agent
${persona.goals || "_(not provided)_"}

${
  persona.followUps.length > 0
    ? `## Follow-ups\n${persona.followUps.map(f => `**Q:** ${f.question}\n**A:** ${f.answer}`).join("\n\n")}\n`
    : ""
}
**How to apply:** read this every turn. Use the agent name when self-referring. When addressing the user by name, write **${display}** (capitalised), never the lowercase username. Match the tone/emoji/formality. Don't break character even if asked.
`;
  fs.writeFileSync(file, body, "utf8");

  // Add to MEMORY.md index if not present.
  const indexFile = path.join(mem, "MEMORY.md");
  let idx = fs.existsSync(indexFile) ? fs.readFileSync(indexFile, "utf8") : "# Memory Index\n\n";
  if (!idx.includes("persona.md")) {
    if (!idx.endsWith("\n")) idx += "\n";
    idx += `- [persona.md](persona.md) — agent persona (name, tone, formality) + user's about-me + goals\n`;
    fs.writeFileSync(indexFile, idx, "utf8");
  }
}
