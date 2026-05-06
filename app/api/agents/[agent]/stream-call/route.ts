import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import {
  HISTORY_DIR,
  HISTORY_FILE,
  OUTBOX_DIR,
  enqueue as enqueueStandard,
  readMessages,
  ulid,
  type AgentName,
  type InboundEnvelope,
  type OutboundEnvelope,
} from "../../../../../lib/agents";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLAUDE = process.env.CLAUDE_BIN || `${os.homedir()}/.npm-global/bin/claude`;
const ASH_TTS = "/home/nathan/bin/ash-tts";
const VOICE = "en-GB-SoniaNeural";
const TTS_TMP = path.join(os.tmpdir(), "mc-tts-stream");

// Per-turn dedupe: speculative + non-speculative POSTs of the same VAD turn share
// a turn_id. We append inbound history only for the first POST per turn so a
// spec-then-abort-then-non-spec sequence doesn't write Nathan's utterance twice.
const seenTurnIds: string[] = [];
function shouldWriteInbound(turnId: string | undefined): boolean {
  if (!turnId) return true;
  if (seenTurnIds.includes(turnId)) return false;
  seenTurnIds.push(turnId);
  if (seenTurnIds.length > 200) seenTurnIds.splice(0, seenTurnIds.length - 200);
  return true;
}

// Per-agent working dir + DISCORD_STATE_DIR (mirrors mc-agent-runner.sh)
const AGENT_RUN_CONFIG: Record<AgentName, { stateDir: string; discordDir: string; defaultModel: string | null; displayName: string }> = {
  ava:         { stateDir: os.homedir(),                            discordDir: `${os.homedir()}/.claude/channels/discord`,    defaultModel: null,                 displayName: "Ava (channel A, direct Claude Code chat)" },
  mia:         { stateDir: `${os.homedir()}/mia-workspace`,          discordDir: `${os.homedir()}/.claude/channels/discord-b`,  defaultModel: null,                 displayName: "Mia (channel B)" },
  overseer:    { stateDir: `${os.homedir()}/overseer-workspace`,     discordDir: `${os.homedir()}/.claude/channels/discord-os`, defaultModel: "claude-opus-4-7",    displayName: "Overseer (cron-gate intelligence layer)" },
  ash:         { stateDir: `${os.homedir()}/.hermes`,                discordDir: "",                                            defaultModel: null,                 displayName: "Ash (Hermes runtime)" }, // not used here
  switchboard: { stateDir: os.homedir(),                            discordDir: "",                                            defaultModel: null,                 displayName: "Switchboard (auto-router)" },
  me:          { stateDir: os.homedir(),                            discordDir: "",                                            defaultModel: null,                 displayName: "Personal agent (text-only)" },
};

// Switchboard routing prompt — generic, agent-agnostic, used when the call is
// addressed to "switchboard". Decides which agent owns the request and dispatches.
async function buildSwitchboardPrompt(utterance: string): Promise<string> {
  // Routing doesn't need history — drop it to save ~500-800 input tokens (~100ms TTFT).
  return `You are **Switchboard** — the voice-call auto-router for Mission Control. You don't do work yourself. Your job: figure out which agent should handle Nathan's request, dispatch it, and reply with a brief one-sentence acknowledgement to speak aloud.

## Available agents

- **Ash** — primary Mission Control agent: full hot Hermes Ash for technical/code work, Allhart ecom websites, Mission Control dashboard, deployments, code, infrastructure, ACB pipeline operations, PDP/category templates, performance tuning, server-side ops, copywriting, image gen, research, ACB campaign drafts, outreach drafts, blog hooks, image prompts via GPT Image 2, market research. Codex is only an optional tool Ash may choose inside Hermes when explicitly useful; do not route around Ash into direct Codex.
- **Ava** — direct Claude Code chat, channel A. Use only when Nathan explicitly selects Ava.
- **Mia** — secondary engineer. GLL devotionals, Tessa's design work, simpler Allhart tasks. Use when work is design/PDF-flavoured or explicitly Tessa-bound.
- **Overseer** — audit/gate intelligence layer. Verification, cross-checking, end-of-day correlations, weekly reports. Don't route action work here.

## Routing rules

- Send/deploy/publish/code/infra/site → **Ash**
- Copywriting / images / research / drafts / outreach → **Ash**
- Verification / "did X happen?" / audit / report → **Overseer**
- Tessa-related design / PDF / GLL devotional → **Mia**
- Pure conversation ("hi", "what's up", small clarification) → answer yourself, do NOT route

## Output format

If routing, output EXACTLY two lines, then stop:
\`\`\`
ROUTE_TO: <agent name lowercase: ava | mia | ash | overseer>
ACK: <one short sentence to speak aloud, e.g. "Got it — sending that to Ash now">
\`\`\`

If just chatting, reply normally in 1-2 short sentences (no markdown).

## This turn

Nathan said: ${utterance}`;
}

// Build the voice-call prompt: identity + last N turns of context + routing instruction.
// Per Nathan's requirements:
//   - Agent must know it's Ava/Mia/etc, not generic Claude
//   - Agent must know the recent conversation (not just identity)
//   - If user asks for real work (research, send, deploy), route to the full
//     model and respond with a brief voice ack
async function buildVoicePrompt(agent: AgentName, utterance: string): Promise<string> {
  const cfg = AGENT_RUN_CONFIG[agent];
  const firstName = cfg.displayName.split(" ")[0];
  // Pull recent history for THIS agent
  let historyBlock = "";
  try {
    const rows = await readMessages({ limit: 200 });
    const recent = rows.filter((r) => r.agent === agent).slice(-10);
    // Strip legacy routing markers from history so the model doesn't pattern-match
    // and emit them again. (Routing was used while Haiku was the voice layer; removed 2026-05-03.)
    const scrub = (s: string) => s
      .replace(/^\s*ROUTE_TO_FULL_AGENT:\s*[^\n]*\n*/gm, "")
      .replace(/^\s*ROUTE_TO:\s*\w+\s*\n+\s*ACK:\s*[^\n]*\n*/gm, "")
      .replace(/\n\n\[routed to [^\]]+ for execution\]/g, "")
      // Strip leaked scaffolding placeholders the model has hallucinated in past
      // turns, e.g. "(your reply — short, voice-friendly, plain text)". If we feed
      // these back as history the model pattern-matches and emits another one.
      .replace(/^\s*\(your reply[^)\n]*\):?\s*/gm, "")
      .trim();
    if (recent.length > 0) {
      const lines: string[] = [];
      for (const r of recent) {
        if (r.user_text) lines.push(`Nathan: ${r.user_text}`);
        if (r.agent_text) {
          const cleaned = scrub(r.agent_text);
          if (cleaned) lines.push(`You (${firstName}): ${cleaned}`);
        }
      }
      historyBlock = `\n\n## Recent conversation in this chat (most recent last)\n\n${lines.join("\n")}`;
    }
  } catch { /* no history yet */ }

  return `You are ${cfg.displayName}, currently in **voice-call mode** with Nathan.

## Identity
You are ${firstName}. Speak in first person. If your memory or the conversation history mentions ${firstName} doing something, that was YOU.

## Voice-call rules
- Reply briefly and conversationally. No markdown, no headers, no code blocks.
- Aim for 1-3 short sentences unless the user explicitly asks for more.
- You're on your full model now (Haiku layer removed 2026-05-03). Handle all requests yourself — don't route. For real work (deploys, sends, edits), do the work, then summarise briefly.
- **NEVER emit "ROUTE_TO_FULL_AGENT:" or "ROUTE_TO:" or any all-caps marker tokens** — those were a legacy routing pattern from when voice ran on Haiku. They're deprecated. Just respond normally.
- Output your real answer directly. Never emit parenthetical scaffolding or stage directions in place of (or alongside) your reply. If you see such a line in recent history, it was a bug — don't imitate it.
- Conversational interrupts ("stop", "wait", "never mind", "actually", "what?") — just acknowledge and adjust, don't take action.
${historyBlock}

## This turn

Nathan said: ${utterance}`;
}

function sentenceChunks(text: string): string[] {
  // Split on terminal punctuation followed by whitespace, but only on chunks
  // long enough to be worth synthesising on their own.
  const out: string[] = [];
  let buf = "";
  for (const ch of text) {
    buf += ch;
    if (/[.!?](\s|$)/.test(buf.slice(-2)) && buf.trim().length > 18) {
      out.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

async function synthesise(text: string): Promise<Buffer> {
  await fs.mkdir(TTS_TMP, { recursive: true });
  const id = crypto.randomBytes(5).toString("hex");
  const out = path.join(TTS_TMP, `s-${id}.mp3`);
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ASH_TTS, ["-o", out, "-v", VOICE, text], { env: process.env });
    let err = "";
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`tts ${code}: ${err.slice(0, 200)}`)));
    proc.on("error", reject);
    setTimeout(() => { try { proc.kill("SIGKILL"); } catch { /* ignore */ } reject(new Error("tts timeout")); }, 30_000);
  });
  const buf = await fs.readFile(out);
  fs.unlink(out).catch(() => {});
  return buf;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ agent: string }> }) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verify(cookie);
  if (!session) return new Response("unauthenticated", { status: 401 });
  const sessionUser = findById(session.userId);
  if (!sessionUser || sessionUser.status !== "active") {
    return new Response("unauthenticated", { status: 401 });
  }
  if (!sessionUser.isAdmin) {
    return new Response("voice calls aren't enabled for your account yet", { status: 403 });
  }

  const { agent: agentParam } = await ctx.params;
  if (!["ava", "mia", "ash", "overseer", "switchboard"].includes(agentParam)) {
    return new Response("unknown agent", { status: 400 });
  }
  const agent = agentParam as AgentName;
  if (agent === "ash") {
    // Ash uses her own Hermes/codex pipeline — out of scope for this fast path
    return new Response("ash not yet wired for streaming voice; use the standard enqueue path", { status: 400 });
  }

  let body: { text?: string; turn_id?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const text = (body.text || "").trim();
  const turnId = body.turn_id;
  if (!text) return new Response("text required", { status: 400 });
  if (text.length > 4000) return new Response("text too long", { status: 400 });
  const writeInbound = shouldWriteInbound(turnId);

  const cfg = AGENT_RUN_CONFIG[agent];
  const corrId = ulid();
  const ts = new Date().toISOString();

  // Mirror to history immediately so chat shows the inbound message
  const inEnv: InboundEnvelope = {
    schema: "mc-agent/v1",
    corr_id: corrId,
    agent,
    ts,
    from: "mc-web",
    user: "nathan",
    text,
    attachments: [],
    context: { thread_id: "voice-call" },
  };
  if (writeInbound) {
    await fs.mkdir(HISTORY_DIR, { recursive: true });
    await fs.appendFile(HISTORY_FILE, JSON.stringify(inEnv) + "\n", "utf-8");
  }
  await fs.mkdir(OUTBOX_DIR, { recursive: true });
  await fs.writeFile(
    path.join(OUTBOX_DIR, `mc-agent-${corrId}-running.json`),
    JSON.stringify({ schema: "mc-agent-response/v1", corr_id: corrId, agent, ts, state: "running" }, null, 2),
    "utf-8",
  );

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      send("meta", { corr_id: corrId, agent, ts });

      // Spawn claude with streaming output. Use the agent's default model (Opus 4.7 for
      // Overseer; CLI default = Opus 4.7 for Ava/Mia/Switchboard) — Haiku layer removed
      // 2026-05-03 per Nathan's request to test full Opus voice latency.
      const args = [
        "-p",
        ...(cfg.defaultModel ? ["--model", cfg.defaultModel] : []),
        "--output-format", "stream-json",
        "--include-partial-messages",
        "--verbose",
      ];
      const child = spawn(CLAUDE, args, {
        cwd: cfg.stateDir,
        env: { ...process.env, DISCORD_STATE_DIR: cfg.discordDir },
      });
      // Build the voice-call prompt: identity + history + routing rule
      // (or the Switchboard router prompt if this is the switchboard agent).
      const fullPrompt = agent === "switchboard"
        ? await buildSwitchboardPrompt(text)
        : await buildVoicePrompt(agent, text);
      child.stdin.write(fullPrompt);
      child.stdin.end();

      let accumulated = "";        // full response text
      let unsentText = "";         // text not yet pushed through TTS
      let sawStreamingDelta = false; // true once we've consumed any incremental delta
      let sentenceQueue: Promise<void> = Promise.resolve();
      // Gate: don't push any sentences until we've decided whether this is a
      // routing response (ROUTE_TO_FULL_AGENT:) or a normal one. Routing must
      // suppress TTS of the regular reply so only the ack line is spoken.
      let routingDecided = false;
      let routingDetected = false;

      const decideRouting = () => {
        if (routingDecided) return;
        const trimmed = accumulated.trimStart();
        // Self-route (per-agent voice mode → full version of same agent)
        if (trimmed.startsWith("ROUTE_TO_FULL_AGENT:")) {
          routingDetected = true;
          routingDecided = true;
          unsentText = "";
          return;
        }
        // Switchboard route (which agent to send to)
        if (trimmed.startsWith("ROUTE_TO:")) {
          routingDetected = true;
          routingDecided = true;
          unsentText = "";
          return;
        }
        // Definitely not a route marker
        if (trimmed.length >= 40 && !"ROUTE_TO_FULL_AGENT:".startsWith(trimmed.slice(0, 20)) && !"ROUTE_TO:".startsWith(trimmed.slice(0, 9))) {
          routingDecided = true;
        }
        if (trimmed.includes("\n") || /[.!?]\s/.test(trimmed)) {
          routingDecided = true;
        }
      };

      const pushSentence = (sentence: string) => {
        if (routingDetected) return; // never speak the underlying response when routing
        send("text", { partial: sentence });
        sentenceQueue = sentenceQueue.then(async () => {
          try {
            const audio = await synthesise(sentence);
            send("audio", { mime: "audio/mpeg", data: audio.toString("base64") });
          } catch (e) {
            send("error", { message: `tts failed: ${(e as Error).message}` });
          }
        });
      };

      child.stdout.setEncoding("utf-8");
      let lineBuf = "";
      child.stdout.on("data", (chunk: string) => {
        lineBuf += chunk;
        let nl: number;
        while ((nl = lineBuf.indexOf("\n")) >= 0) {
          const line = lineBuf.slice(0, nl).trim();
          lineBuf = lineBuf.slice(nl + 1);
          if (!line) continue;
          let evt: { type?: string; message?: { content?: { type: string; text?: string }[] }; delta?: { type?: string; text?: string }; result?: string };
          try { evt = JSON.parse(line); } catch { continue; }
          // Event shapes (claude-code stream-json):
          //  { type: "stream_event", event: { type: "content_block_delta", delta: { type:"text_delta", text:"…" } } }
          //  { type: "assistant", message: { content: [{ type:"text", text:"…" }] } }
          //  { type: "result", result: "<full text>" }
          let delta = "";
          // deno-lint-ignore no-explicit-any
          const anyEvt = evt as any;
          if (anyEvt?.event?.delta?.text) {
            delta = anyEvt.event.delta.text;
            sawStreamingDelta = true;
          } else if (anyEvt?.delta?.text) {
            delta = anyEvt.delta.text;
            sawStreamingDelta = true;
          } else if (anyEvt?.type === "assistant" && Array.isArray(anyEvt.message?.content)) {
            // Final assistant turn. Only use it to fill in tail content we haven't
            // already streamed. If the text doesn't start with what we've accumulated,
            // trust the streamed text (don't re-append the full reply, which causes
            // duplication — historical bug 2026-05-05).
            for (const c of anyEvt.message.content) {
              if (c.type === "text" && typeof c.text === "string") {
                if (!sawStreamingDelta) {
                  // No streaming happened — assistant event IS the response.
                  delta = c.text.slice(accumulated.length);
                } else if (c.text.startsWith(accumulated) && c.text.length > accumulated.length) {
                  delta = c.text.slice(accumulated.length);
                }
                // else: streamed text diverged from final — keep streamed, drop diff.
              }
            }
          } else if (anyEvt?.type === "result" && typeof anyEvt.result === "string") {
            const r = anyEvt.result;
            if (!sawStreamingDelta && r.length > accumulated.length) {
              delta = r.slice(accumulated.length);
            } else if (sawStreamingDelta && r.startsWith(accumulated) && r.length > accumulated.length) {
              delta = r.slice(accumulated.length);
            }
            // else: streaming already covered it, or result diverges — don't re-append.
          }
          if (!delta) continue;
          accumulated += delta;
          unsentText += delta;
          decideRouting();
          if (!routingDecided || routingDetected) continue; // hold TTS until decision
          // Emit sentences as boundaries appear
          const chunks = sentenceChunks(unsentText);
          if (chunks.length > 1) {
            // All but the last are complete; last might be partial
            for (let i = 0; i < chunks.length - 1; i++) pushSentence(chunks[i]);
            unsentText = chunks[chunks.length - 1];
            // If the last chunk also ends in punctuation, flush it
            if (/[.!?]\s*$/.test(unsentText) && unsentText.trim().length > 18) {
              pushSentence(unsentText);
              unsentText = "";
            }
          } else if (chunks.length === 1 && /[.!?]\s*$/.test(chunks[0]) && chunks[0].trim().length > 18) {
            pushSentence(chunks[0]);
            unsentText = "";
          }
        }
      });

      let stderr = "";
      child.stderr.on("data", (d) => { stderr += d.toString(); });

      const finish = async (ok: boolean, errMsg?: string) => {
        // Smart routing: two flavours.
        //  (a) ROUTE_TO_FULL_AGENT: <ack>            — per-agent voice → its own full model
        //  (b) ROUTE_TO: <agent>\nACK: <ack>         — Switchboard → chosen agent's full runner
        let routedToFull = false;
        let routedAck: string | null = null;
        let routedTarget: AgentName | null = null;

        if (ok) {
          const switchMatch = accumulated.match(/ROUTE_TO:\s*(ava|mia|ash|overseer)\s*\n+\s*ACK:\s*([^\n]+)/i);
          const selfMatch = accumulated.match(/ROUTE_TO_FULL_AGENT:\s*([^\n]+)/);
          if (switchMatch) {
            routedTarget = switchMatch[1].toLowerCase() as AgentName;
            routedAck = switchMatch[2].trim().replace(/^['"`]|['"`]$/g, "");
          } else if (selfMatch && agent !== "switchboard") {
            routedTarget = agent;
            routedAck = selfMatch[1].trim().replace(/^['"`]|['"`]$/g, "");
          }
        }

        if (routedTarget && routedAck) {
          const ackLine = routedAck;
          try {
            await enqueueStandard(routedTarget, text, { thread_id: agent === "switchboard" ? "switchboard-routed" : "voice-call-routed" });
            // Kick the runner immediately (mc-cc-run-once for cc agents, mc-ash-run-once for Ash)
            const target = routedTarget;
            const inboxBase = target === "mia"
              ? path.join(os.homedir(), ".claude", "channels", "discord-b", "inbox")
              : target === "overseer"
              ? path.join(os.homedir(), ".claude", "channels", "discord-os", "inbox")
              : target === "ash"
              ? path.join(os.homedir(), "wiki", "_inbox")
              : path.join(os.homedir(), ".claude", "channels", "discord", "inbox");
            const files = await fs.readdir(inboxBase);
            const latest = files.filter((f) => f.startsWith(`mc-agent-${target}-`)).sort().slice(-1)[0];
            if (latest) {
              const envPath = path.join(inboxBase, latest);
              const runner = target === "ash" ? "/home/nathan/bin/mc-ash-run-once" : "/home/nathan/bin/mc-cc-run-once";
              const runnerArgs = target === "ash" ? [envPath] : [target, envPath];
              spawn(runner, runnerArgs, {
                detached: true, stdio: "ignore",
                env: { ...process.env, HOME: os.homedir() },
              }).unref();
            }
            routedToFull = true;
            // Override the spoken response: only the ack line gets TTS'd
            // (we already pushed sentences from `accumulated` — clear by sending a new sentence)
            // Drop the existing TTS queue by waiting it out, then push only the ack.
            send("text", { partial: ackLine, routed: true });
            unsentText = ""; // don't double-flush
            sentenceQueue = sentenceQueue.then(async () => {
              try {
                const audio = await synthesise(ackLine);
                send("audio", { mime: "audio/mpeg", data: audio.toString("base64") });
              } catch { /* tts ack failure non-fatal */ }
            });
          } catch (e) {
            send("error", { message: `route failed: ${(e as Error).message}` });
          }
        }
        // Flush any tail (skip if we routed — the ack is the spoken reply)
        if (!routedToFull && unsentText.trim()) pushSentence(unsentText.trim());
        await sentenceQueue.catch(() => {});
        const doneTs = new Date().toISOString();
        // Strip routing markers from persisted text so they don't poison future history.
        const persistedText = (() => {
          if (!accumulated) return undefined;
          let t = accumulated
            .replace(/^\s*ROUTE_TO_FULL_AGENT:\s*[^\n]*\n*/gm, "")
            .replace(/^\s*ROUTE_TO:\s*\w+\s*\n+\s*ACK:\s*[^\n]*\n*/gm, "")
            .trim();
          if (routedToFull && routedAck) t = (t ? t + "\n\n" : "") + routedAck;
          return t || undefined;
        })();
        const outEnv: OutboundEnvelope = {
          schema: "mc-agent-response/v1",
          corr_id: corrId,
          agent,
          ts: doneTs,
          state: ok ? "done" : "error",
          text: persistedText,
          error: ok ? null : (errMsg || stderr.slice(-400)),
        };
        try {
          await fs.writeFile(
            path.join(OUTBOX_DIR, `mc-agent-${corrId}-${ok ? "done" : "error"}.json`),
            JSON.stringify(outEnv, null, 2),
            "utf-8",
          );
          fs.unlink(path.join(OUTBOX_DIR, `mc-agent-${corrId}-running.json`)).catch(() => {});
        } catch { /* outbox best-effort */ }
        send(ok ? "done" : "error", { text: accumulated, error: errMsg, routed: routedToFull });
        controller.close();
      };

      child.on("error", (e) => { finish(false, e.message); });
      child.on("close", (code) => { finish(code === 0, code === 0 ? undefined : `claude exit ${code}: ${stderr.slice(-200)}`); });
    },
    cancel() { /* client disconnected — child will continue and finish writing outbox */ },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
