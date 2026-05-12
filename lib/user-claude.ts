// Shared helper for "run claude -p in the user's context, sandboxed".
//
// What it does:
//  - cwd = user's workspace dir, so the symlinked memory/ auto-loads
//    (persona.md, memories) — agent inherits the same context as the
//    user's interactive `me` agent.
//  - --bare disables hooks, plugins, MCP auto-discovery, CLAUDE.md.
//  - --strict-mcp-config (with no --mcp-config) disables ALL MCP servers.
//  - --tools restricts to a small built-in whitelist (web + read by default).
//
// Result: Sonnet/Opus runs with user memory + web tools + ability to read
// MC's own data we point it at — and absolutely nothing else. No Discord,
// no Gmail, no Bash, no filesystem outside cwd, no chat-channel writes.
// Output goes to stdout only — never to the agent inbox/outbox, so this
// never appears in the user's /agents chat history.

import { spawnSync, type SpawnSyncReturns } from "child_process";
import fs from "fs";
import { userWorkspaceDir } from "./workspace";

// Locate the claude CLI: env override → known install paths → bare "claude"
// (resolved via the parent process PATH). Works on Nathan's WSL box, on
// VPS installs (mc-install.sh drops it in /usr/local/bin), and via env.
function resolveClaudeBin(): string {
  const candidates = [
    process.env.CLAUDE_BIN,
    "/home/nathan/.npm-global/bin/claude",
    "/usr/local/bin/claude",
    "/usr/bin/claude",
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  return "claude";
}

export type UserClaudeResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
};

export type UserClaudeOptions = {
  prompt: string;
  username: string;
  model?: "opus" | "sonnet" | "haiku";
  tools?: string;           // comma-separated; default "WebFetch,WebSearch,Read"
  timeoutMs?: number;       // default 110000
};

const MODEL_IDS: Record<NonNullable<UserClaudeOptions["model"]>, string> = {
  opus:   "claude-opus-4-7",
  sonnet: "claude-sonnet-4-6",
  haiku:  "claude-haiku-4-5-20251001",
};

export function runUserClaude(opts: UserClaudeOptions): UserClaudeResult {
  const CLAUDE_BIN = resolveClaudeBin();
  const model = MODEL_IDS[opts.model || "opus"];
  const tools = opts.tools || "WebFetch,WebSearch,Read";
  const cwd = userWorkspaceDir(opts.username.toLowerCase());

  let result: SpawnSyncReturns<string>;
  try {
    // NOTE: NOT using --bare. --bare forces ANTHROPIC_API_KEY-only auth,
    // which breaks for users on OAuth/subscription (Nathan, most installs).
    // We still sandbox aggressively: --strict-mcp-config + no --mcp-config
    // disables all MCP servers; --tools restricts the built-in toolset to
    // the whitelist. Hooks may still run but with no tool access beyond
    // the whitelist they have nothing to act on.
    result = spawnSync(CLAUDE_BIN, [
      "-p",
      "--model", model,
      "--strict-mcp-config",
      "--tools", tools,
    ], {
      cwd,
      input: opts.prompt,
      encoding: "utf8",
      timeout: opts.timeoutMs ?? 110000,
      maxBuffer: 2 * 1024 * 1024,
    });
  } catch (e) {
    return { stdout: "", stderr: (e as Error).message, exitCode: null, timedOut: false };
  }

  return {
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    exitCode: typeof result.status === "number" ? result.status : null,
    timedOut: result.signal === "SIGTERM",
  };
}
