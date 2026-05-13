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

/**
 * Write the seven onboarding-pillar memory files + a richer persona.md.
 * Called after the conversational interview compiles to a CompiledPlan.
 * Safe to call alongside writePersona — both write to memoryDir(username).
 */
export function writeOnboardingMemories(username: string, plan: {
  agentName: string;
  identity: { role: string; context: string; about: string };
  friction: { painPoints: string[]; topConcern: string };
  tools: { primary: string[]; notes: string };
  dashboard: { wantsBentos: string[]; pinnedApps: string[]; notes: string };
  comms: { tone: string; formality: string; emoji: boolean; notes: string };
  focus: { initialGoals: string[]; firstWeek: string };
  principles: { boundaries: string[]; careful: string[]; mustDo: string[] };
  summary: string;
}): void {
  const u = username.toLowerCase();
  const display = u ? u[0].toUpperCase() + u.slice(1) : u;
  const mem = memoryDir(u);
  fs.mkdirSync(mem, { recursive: true });

  const bullets = (arr: string[]) => arr.length ? arr.map((b) => `- ${b}`).join("\n") : "_(none specified)_";
  const files: { name: string; title: string; desc: string; type: string; body: string }[] = [
    {
      name: "user_identity.md",
      title: `Who ${display} is`,
      desc: `${display}'s role, work context, and identity — set during onboarding`,
      type: "user",
      body: `**Role:** ${plan.identity.role || "_(not specified)_"}\n\n**Work context:** ${plan.identity.context || "_(not specified)_"}\n\n**About:**\n${plan.identity.about || "_(not specified)_"}`,
    },
    {
      name: "user_friction.md",
      title: `${display}'s pain points`,
      desc: `Where ${display}'s work gets messy / forgotten / scattered — set during onboarding`,
      type: "user",
      body: `**Top concern:** ${plan.friction.topConcern || "_(not specified)_"}\n\n**Pain points:**\n${bullets(plan.friction.painPoints)}\n\n**How to apply:** when ${display} mentions any of these symptoms in chat, recognise it and offer concrete help on that specific friction first.`,
    },
    {
      name: "user_tools.md",
      title: `Where ${display}'s info lives`,
      desc: `${display}'s primary tool stack — set during onboarding`,
      type: "reference",
      body: `**Primary tools:**\n${bullets(plan.tools.primary)}\n\n**Notes:** ${plan.tools.notes || "_(none)_"}\n\n**How to apply:** if ${display} mentions "the report" / "the dashboard" / "the spreadsheet" without specifying, default to the most likely tool above.`,
    },
    {
      name: "user_focus.md",
      title: `What ${display} wants from the AI first`,
      desc: `Initial goals + first-week focus — set during onboarding`,
      type: "feedback",
      body: `**First week:** ${plan.focus.firstWeek || "_(not specified)_"}\n\n**Initial goals:**\n${bullets(plan.focus.initialGoals)}\n\n**How to apply:** weight your suggestions and proactive nudges toward these goals for the first month, then re-prompt ${display} to update them.`,
    },
    {
      name: "user_principles.md",
      title: `${display}'s operating principles`,
      desc: `Boundaries + careful-with + must-do behaviours — set during onboarding`,
      type: "feedback",
      body: `**Must do:**\n${bullets(plan.principles.mustDo)}\n\n**Be careful with:**\n${bullets(plan.principles.careful)}\n\n**Boundaries (never do):**\n${bullets(plan.principles.boundaries)}\n\n**How to apply:** these are durable rules. Apply every turn. Never violate the boundaries even if asked.`,
    },
  ];

  for (const f of files) {
    const front = `---\nname: ${f.name.replace(/\.md$/, "")}\ndescription: ${f.desc}\ntype: ${f.type}\n---\n\n# ${f.title}\n\n${f.body}\n`;
    fs.writeFileSync(path.join(mem, f.name), front, "utf8");
  }

  // Updated persona.md driven by the compiled summary + comms.
  const personaBody = `---
name: agent-persona
description: How this agent should behave for ${display} — compiled from onboarding interview.
type: feedback
---

# Agent persona for ${display}

**Agent name:** ${plan.agentName || "Agent"}
**Tone:** ${plan.comms.tone}
**Emoji:** ${plan.comms.emoji ? "yes" : "no"}
**Formality:** ${plan.comms.formality}

## Summary of who ${display} is
${plan.summary || "_(no summary)_"}

${plan.comms.notes ? `## Communication notes\n${plan.comms.notes}\n` : ""}

**How to apply:** read this every turn alongside user_identity.md, user_friction.md, user_tools.md, user_focus.md, and user_principles.md. Use the agent name when self-referring. When addressing the user by name, write **${display}** (capitalised). Match the tone/emoji/formality. Don't break character.
`;
  fs.writeFileSync(path.join(mem, "persona.md"), personaBody, "utf8");

  // Update MEMORY.md index.
  const indexFile = path.join(mem, "MEMORY.md");
  const indexEntries = [
    "- [persona.md](persona.md) — agent persona (name, tone, summary)",
    "- [user_identity.md](user_identity.md) — who they are, role, work context",
    "- [user_friction.md](user_friction.md) — pain points, top concern",
    "- [user_tools.md](user_tools.md) — tool stack",
    "- [user_focus.md](user_focus.md) — first-week goals",
    "- [user_principles.md](user_principles.md) — boundaries, careful-with, must-do",
  ];
  const header = "# Memory Index\n\n";
  fs.writeFileSync(indexFile, header + indexEntries.join("\n") + "\n", "utf8");
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
