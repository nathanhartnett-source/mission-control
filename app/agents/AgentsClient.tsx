"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import PixelAvatar from "@/app/components/PixelAvatar";
import { useMe } from "@/app/components/MeProvider";
import { agentAvatarSeed } from "@/lib/avatar";

type AgentName = "ava" | "mia" | "ash" | "overseer" | "switchboard" | "me";
type EnvelopeState = "queued" | "running" | "done" | "error";

type ThinkingEvent = {
  kind: "thinking" | "tool_use";
  text: string;
  ts?: string;
};

type Delegation = {
  // Widened from "ava"|"ash"|"overseer" so in-process Task/Agent sub-agents
  // (subagent_type values like "Explore", "general-purpose") also fit. See
  // lib/agents.ts for the canonical definition — this type mirrors it.
  to: string;
  task: string;
  corr_id: string;
  ts: string;
  display_name?: string;
  display_reason?: string;
  kind?: "task-tool" | "agent-delegate";
};

type MessageRow = {
  corr_id: string;
  agent: AgentName;
  user_text?: string;
  user_ts?: string;
  user?: string;
  user_attachments?: { name: string; path: string; mime?: string; size?: number }[];
  agent_state?: EnvelopeState;
  agent_text?: string;
  agent_ts?: string;
  elapsed_ms?: number;
  error?: string | null;
  memory_saved?: string[];
  wiki_saved?: string[];
  skills_saved?: string[];
  thinking_events?: ThinkingEvent[];
  delegations?: Delegation[];
  last_event_ts?: string;
  activity_kind?: "thinking" | "doing";
  current_tool?: string | null;
  current_tool_summary?: string | null;
  current_tool_summary_ts?: string | null;
};

// Whimsical fallback strings for the disclosure when no tool has fired yet.
// Kept short (≤40 chars) so they fit the same line as a real tool snippet.
// Long list intentionally — cycles every few seconds, don't want repeats.
const HUMOR_LINES = [
  "…did I put the rubbish out?",
  "…initializing flux capacitor…",
  "…rummaging through the token bag…",
  "…asking the model very politely…",
  "…brewing a small coffee for the LLM…",
  "…stewing on it…",
  "…aligning the dilithium crystals…",
  "…proofreading the prompt one more time…",
  "…consulting the rubber duck…",
  "…checking under the couch cushions…",
  "…feeding the hamster wheel…",
  "…debugging in my head…",
  "…holding the model's hand…",
  "…rounding up stray semicolons…",
  "…squinting at the requirements…",
  "…drawing it out on a napkin…",
  "…polishing the response…",
  "…teaching the parrot new words…",
  "…running it past the cat…",
  "…warming up the GPUs (mentally)…",
  "…pondering the orb…",
  "…finishing this sentence…",
  "…buffering the thought…",
  "…oiling the cogs…",
  "…interviewing the model…",
  "…sharpening pencils…",
  "…setting up the whiteboard…",
  "…taking a deep breath…",
  "…remembering what we were doing…",
  "…flipping through the dictionary…",
  "…reticulating splines…",
  "…calibrating the goose…",
  "…un-calibrating the goose…",
  "…feeding ducks at the pond…",
  "…composing a haiku first…",
  "…re-reading your message slowly…",
  "…doing a quick cardio set…",
  "…asking Ash for a second opinion…",
  "…asking Ava for a second opinion…",
  "…googling, but tastefully…",
  "…politely asking the database…",
  "…hunting for the off-by-one…",
  "…locating my coffee mug…",
  "…rebooting the imagination…",
  "…assembling lego instructions…",
  "…humming a little tune…",
  "…rotating the schema 90 degrees…",
  "…pretending to know regex…",
  "…actually reading the docs…",
  "…fluffing the cushions…",
  "…sweeping under the rug…",
  "…stretching before the heavy lift…",
  "…rolling the dice in my head…",
  "…opening 27 tabs you can't see…",
  "…closing 26 tabs you can't see…",
  "…unfolding the laundry of logic…",
  "…running it past the dog…",
  "…filing under \"think later\"…",
  "…un-filing from \"think later\"…",
  "…drawing a small flowchart…",
  "…erasing the small flowchart…",
  "…dusting off the manual…",
  "…re-reading the spec for nuance…",
  "…ignoring the spec, briefly…",
  "…rummaging in /tmp…",
  "…asking systemd nicely…",
  "…doing a Cloudflare cache purge in spirit…",
  "…thinking like Tessa for a sec…",
  "…thinking like Nathan for a sec…",
  "…inhaling, exhaling, continuing…",
  "…channeling vintage HyperCard energy…",
  "…recalling something Brett said once…",
  "…asking the linter for grace…",
  "…composing the perfect commit message…",
  "…un-composing it…",
  "…humming the Star Trek theme…",
  "…pretending I read the ticket…",
  "…actually reading the ticket…",
  "…peeling potatoes in my head…",
  "…running through Brisbane in my mind…",
  "…wondering if it's lunchtime yet…",
  "…wondering if it's coffee o'clock…",
  "…stacking the right blocks…",
  "…un-stacking the wrong blocks…",
  "…borrowing logic from a future me…",
  "…aligning to true north…",
  "…asking the model to slow down…",
  "…asking the model to hurry up…",
  "…locating misplaced punctuation…",
  "…cross-referencing the side-eye…",
  "…sketching a quick UML diagram…",
  "…burning the UML diagram…",
  "…feeding the linter a biscuit…",
  "…apologising to the linter…",
  "…pacing dramatically…",
  "…leaning back in my chair…",
  "…remembering an old TODO…",
  "…ignoring the old TODO…",
  "…doing it properly this time…",
  "…thinking really hard, you can tell…",
  "…stretching the metaphor too far…",
  "…tightening the metaphor back up…",
  "…doing a small stretch routine…",
  "…drinking a metaphorical water…",
  "…pretending the YAML makes sense…",
  "…shrugging in JSON…",
  "…politely confronting the bug…",
  "…taking the bug out for tea…",
  "…explaining myself to a duck…",
  "…rebuilding tower of thoughts…",
  "…knocking over tower of thoughts…",
  "…rebuilding it again, smaller…",
  "…running diagnostics on my mood…",
  "…filing a complaint with reality…",
];

const AGENT_ORDER: AgentName[] = ["switchboard", "ash", "ava", "mia", "overseer"];

const AGENT_META: Record<AgentName, { name: string; subtitle: string; color: string; dot: string }> = {
  switchboard: { name: "Switchboard", subtitle: "Auto-route call · best for end-users", color: "text-sky-300",     dot: "bg-sky-400"     },
  ava:         { name: "Ava",         subtitle: "Claude Code · channel A",              color: "text-violet-300",  dot: "bg-violet-400"  },
  mia:         { name: "Mia",         subtitle: "Claude Code · channel B",              color: "text-pink-300",    dot: "bg-pink-400"    },
  ash:         { name: "Ash",         subtitle: "Hermes · GPT-5.5",                     color: "text-amber-300",   dot: "bg-amber-400"   },
  overseer:    { name: "Overseer",    subtitle: "Claude Code · Opus 4.7",               color: "text-emerald-300", dot: "bg-emerald-400" },
  me:          { name: "Your agent",  subtitle: "Personal agent",                       color: "text-violet-300",  dot: "bg-violet-400"  },
};

const SAFETY_KEYWORDS = [
  "send", "deploy", "publish", "push", "merge",
  "delete", "drop", "--force", "force-push",
  "rm -rf", "git reset --hard",
];

function detectKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return SAFETY_KEYWORDS.filter((k) => lower.includes(k));
}

function normaliseVoiceText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
}

function isAshCasualVoiceOnly(text: string): boolean {
  const t = normaliseVoiceText(text);
  if (!t) return false;
  if (/^(hi|hey|hello|yo|morning|good morning|good afternoon|good evening|hiya|you there|u there|are you there)( ash)?$/.test(t)) return true;
  if (/^(how are you|how are you going|what's up|whats up|sup)( ash)?$/.test(t)) return true;
  if (/^(thanks|thank you|cheers|nice|cool|okay|ok|yep|yeah|no worries)( ash)?$/.test(t)) return true;
  return false;
}

function isAshVoiceTaskRequest(text: string): boolean {
  const t = normaliseVoiceText(text);
  return /\b(fix|change|update|build|deploy|restart|check|look up|research|find|search|run|test|verify|create|write|draft|send|publish|schedule|upload|download|delete|remove|add|wire|implement|debug|diagnose|make|do this|go do|work on)\b/.test(t);
}

function ashCasualVoiceReply(text: string): string {
  const t = normaliseVoiceText(text);
  if (t.includes("morning")) return "Morning Nathan. I’m here.";
  if (t.includes("how are you")) return "I’m good — here and ready.";
  if (t.includes("thank") || t === "thanks" || t === "cheers") return "Anytime.";
  if (t === "you there" || t === "u there" || t.includes("are you there")) return "Yep, I’m here.";
  return "Hey Nathan — I’m here.";
}

// Auto-grow composer textarea: collapses to one line when empty (incl. after
// programmatic setText("") on send), grows up to maxPx as content wraps.
function useAutogrowTextarea(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxPx = 128,
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, maxPx) + "px";
  }, [ref, value, maxPx]);
}

// Hide the "[attachments]\n- name (mime) → path" tail that the enqueue route
// appends so the agent sees file paths inline. The structured user_attachments
// array carries the same info and is rendered visually below the text.
function stripAttachmentTail(text?: string): string {
  if (!text) return "";
  return text.replace(/\n*\[attachments\]\n(?:- .*(?:\n|$))+/, "").trimEnd();
}

// Resolve an image reference (markdown ![](path) or bare /path/to.png) into
// the URL the browser should fetch + a download href + a sensible filename.
function resolveImageRef(p: string): { src: string; downloadHref: string; filename: string } {
  const trimmed = p.trim();
  const filename = trimmed.split("/").pop() || "image";
  // Web URLs (http(s)://) — pass through.
  if (/^https?:\/\//i.test(trimmed)) {
    return { src: trimmed, downloadHref: trimmed, filename };
  }
  // Web-relative public paths (e.g. /avatars/foo.png) — pass through.
  if (trimmed.startsWith("/") && !trimmed.startsWith("/home/") && !trimmed.startsWith("/tmp/")) {
    return { src: trimmed, downloadHref: trimmed, filename };
  }
  // Filesystem absolute — route through the attachment endpoint.
  const url = `/api/agents/attachment?path=${encodeURIComponent(trimmed)}`;
  return { src: url, downloadHref: url, filename };
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div className="relative my-2 group">
      <pre className="overflow-x-auto rounded-lg border border-slate-700/50 bg-slate-900/70 p-3 pr-16 text-[12px] text-slate-100 font-mono whitespace-pre">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={onCopy}
        className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-200 bg-slate-700/70 hover:bg-slate-600 border border-slate-600/50"
        title="Copy to clipboard"
      >
        {copied ? "Copied" : "Copy"}
        {lang ? <span className="ml-1 opacity-60">{lang}</span> : null}
      </button>
    </div>
  );
}

// Linkifies a plain text string: converts [text](url) markdown links and bare
// http(s) URLs into <a target="_blank"> nodes. Returns React nodes preserving
// surrounding whitespace.
function linkify(text: string, keyPrefix: string): React.ReactNode {
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;
  const out: React.ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) out.push(text.slice(lastIdx, m.index));
    const label = m[1] ?? m[3];
    const href = m[2] ?? m[3];
    out.push(
      <a
        key={`${keyPrefix}-l-${key++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sky-400 hover:text-sky-300 underline underline-offset-2 break-all"
      >
        {label}
      </a>,
    );
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) out.push(text.slice(lastIdx));
  return out.length === 0 ? text : <>{out}</>;
}

// Tailwind selector bundle that styles whatever HTML marked emits for the
// non-code-block, non-image text segments. Tables here are the headline —
// previously rendered as raw "|---|" ASCII, now real <table>s.
const MD_TAILWIND = "whitespace-normal break-words " +
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 " +
  "[&_p]:my-1.5 [&_strong]:font-semibold [&_em]:italic " +
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_li]:my-0 " +
  "[&_code]:text-amber-300 [&_code]:bg-slate-900/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs " +
  "[&_a]:text-indigo-300 hover:[&_a]:underline " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-slate-600 [&_blockquote]:pl-3 [&_blockquote]:text-slate-300 [&_blockquote]:my-2 " +
  "[&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2.5 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 " +
  "[&_table]:my-2 [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-md [&_table]:border [&_table]:border-slate-700 " +
  "[&_thead]:bg-slate-900/60 " +
  "[&_th]:text-left [&_th]:font-semibold [&_th]:text-slate-200 [&_th]:px-2 [&_th]:py-1.5 [&_th]:border-b [&_th]:border-slate-700 " +
  "[&_td]:px-2 [&_td]:py-1.5 [&_td]:border-t [&_td]:border-slate-800/80 [&_td]:align-top " +
  "[&_tbody_tr:nth-child(even)]:bg-slate-900/30";

function renderMarkdownSegment(seg: string, key: string): React.ReactNode {
  const html = marked.parse(seg, { breaks: true, gfm: true, async: false }) as string;
  return <div key={key} className={MD_TAILWIND} dangerouslySetInnerHTML={{ __html: html }} />;
}

// Renders a plain-text segment (no fenced code) with inline markdown images.
function renderPlainWithImages(text: string, keyPrefix: string): React.ReactNode[] {
  const re = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) {
      const seg = text.slice(lastIdx, m.index);
      if (seg.trim().length > 0) {
        parts.push(renderMarkdownSegment(seg, `${keyPrefix}-t-${key++}`));
      }
    }
    const alt = m[1];
    const { src, downloadHref, filename } = resolveImageRef(m[2]);
    parts.push(
      <div key={`${keyPrefix}-i-${key++}`} className="my-2">
        <a href={src} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt || filename} className="max-h-72 max-w-full rounded-lg border border-slate-700/40 object-contain" />
        </a>
        <a
          href={downloadHref}
          download={filename}
          className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] text-slate-200 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/40"
          title={`Download ${filename}`}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download {filename}
        </a>
      </div>,
    );
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    const seg = text.slice(lastIdx);
    if (seg.trim().length > 0) {
      parts.push(renderMarkdownSegment(seg, `${keyPrefix}-t-${key++}`));
    }
  }
  if (parts.length === 0) {
    return [renderMarkdownSegment(text, `${keyPrefix}-fallback`)];
  }
  return parts;
}

// Renders agent reply text with fenced code blocks (with copy button) and
// inline markdown images (`![alt](path)`). Plain text keeps whitespace-pre-wrap.
function RichAgentText({ text }: { text: string }) {
  const fence = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(text)) !== null) {
    if (m.index > lastIdx) {
      const seg = text.slice(lastIdx, m.index);
      parts.push(...renderPlainWithImages(seg, `s${key++}`));
    }
    const lang = m[1] || undefined;
    const code = m[2].replace(/\n$/, "");
    parts.push(<CodeBlock key={`c-${key++}`} code={code} lang={lang} />);
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    const seg = text.slice(lastIdx);
    parts.push(...renderPlainWithImages(seg, `s${key++}`));
  }
  if (parts.length === 0) {
    return <div className="whitespace-pre-wrap break-words">{text}</div>;
  }
  return <>{parts}</>;
}


function DelegationChip({ d }: { d: Delegation }) {
  // Two flavours:
  //   1. Cross-agent agent-delegate hand-off (legacy `to: "ash"|"overseer"`,
  //      no display fields). Render the original compact pill.
  //   2. In-process Task/Agent tool sub-agent (kind === "task-tool", with
  //      display_name + display_reason picked by mc-agent-stream-parser.py
  //      from ~/.claude/assets/sub-agent-roster.json). Render a richer card
  //      with a pixel-art avatar so the sub-agent feels like a person.
  if (d.display_name) {
    const reason = d.display_reason || "";
    return (
      <span
        key={`d-${d.corr_id}`}
        className="inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full text-[11px] text-rose-100 bg-rose-500/15 border border-rose-500/30"
        title={`Sub-agent ${d.to}: ${d.task}`}
      >
        <PixelAvatar seed={d.display_name} size={22} />
        <span>
          <span className="opacity-70">I&apos;m giving this to </span>
          <span className="font-semibold text-rose-50">{d.display_name}</span>
          {reason ? <span className="opacity-70">, {reason}</span> : null}
        </span>
      </span>
    );
  }
  return (
    <span
      key={`d-${d.corr_id}`}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-rose-200 bg-rose-500/15 border border-rose-500/30"
      title={`Delegated to ${d.to}: ${d.task}`}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 2 11 13" />
        <path d="M22 2 15 22 11 13 2 9 22 2z" />
      </svg>
      → {d.to}
    </span>
  );
}

function AttachmentList({ files }: { files: { name: string; path: string; mime?: string; size?: number }[] }) {
  if (!files || files.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {files.map((a, i) => {
        const url = `/api/agents/attachment?path=${encodeURIComponent(a.path)}`;
        const isImage = (a.mime || "").startsWith("image/");
        if (isImage) {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <a key={i} href={url} target="_blank" rel="noreferrer" className="block">
              <img src={url} alt={a.name} className="max-h-48 max-w-full rounded-lg border border-slate-700/40 object-contain" />
            </a>
          );
        }
        return (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-800/60 border border-slate-700/40 text-xs text-slate-200 hover:bg-slate-800"
            title={a.path}
          >
            <span className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-[10px] text-slate-400">F</span>
            <span className="truncate max-w-[160px]">{a.name}</span>
            {typeof a.size === "number" ? <span className="text-slate-500">{Math.max(1, Math.round(a.size / 1024))}KB</span> : null}
          </a>
        );
      })}
    </div>
  );
}

// Thresholds (seconds since last stream event from the agent) for the running pill.
// Green = active, yellow = quiet (probably mid-tool), red = likely stuck.
//
// When a tool is in flight (currentTool set), we use a much longer red threshold —
// long-running Bash like `codex exec`, `npm run build`, `npx tsc` etc legitimately
// emit no claude-stream events for 5–15 min, and falsely showing "stuck" was
// causing real interruptions on real work.
const STUCK_YELLOW_S = 30;
const STUCK_RED_S    = 180;
const STUCK_RED_S_TOOL = 900;

function StateBadge({
  state,
  lastEventTs,
  activityKind,
  currentTool,
  now,
}: {
  state?: EnvelopeState;
  lastEventTs?: string;
  activityKind?: "thinking" | "doing";
  currentTool?: string | null;
  now?: number;
}) {
  if (!state) return null;
  if (state === "running") {
    const last = lastEventTs ? new Date(lastEventTs).getTime() : 0;
    const ageS = last && now ? Math.max(0, Math.floor((now - last) / 1000)) : 0;
    // When a tool is running, the agent is legitimately silent on the stream.
    // Use the tool-aware red threshold so long Bash/Edit don't false-alarm.
    const redThreshold = currentTool ? STUCK_RED_S_TOOL : STUCK_RED_S;
    let cls: string;
    let dot: string;
    const activeCls = activityKind === "doing"
      ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
      : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    const activeDot = activityKind === "doing"
      ? "bg-sky-400 animate-pulse"
      : "bg-emerald-400 animate-pulse";
    if (!last) {
      cls = activeCls;
      dot = activeDot;
    } else if (ageS < STUCK_YELLOW_S) {
      cls = activeCls;
      dot = activeDot;
    } else if (ageS < redThreshold) {
      cls = "bg-amber-500/15 text-amber-300 border-amber-500/30";
      dot = "bg-amber-400";
    } else {
      cls = "bg-red-500/20 text-red-300 border-red-500/40";
      dot = "bg-red-400 animate-pulse";
    }
    const label = activityKind === "doing" ? "Doing" : "Thinking";
    const ageLabel = last ? (ageS < 60 ? `${ageS}s` : `${Math.floor(ageS / 60)}m${ageS % 60 ? ` ${ageS % 60}s` : ""}`) : "";
    const stuckMsg = currentTool
      ? `tool ${currentTool} has been running ≥15min — may be stuck. Use Stop to kill.`
      : "no activity for ≥3min — may be stuck. Use Stop to kill.";
    const tip = [
      `state: ${label.toLowerCase()}`,
      currentTool ? `tool: ${currentTool}` : null,
      last ? `last event ${ageLabel} ago` : null,
      ageS >= redThreshold ? stuckMsg : null,
    ].filter(Boolean).join(" · ");
    return (
      <span
        title={tip}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider border leading-none ${cls}`}
      >
        <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        <span className="leading-none">{label}</span>
        {currentTool ? <span className="normal-case font-normal opacity-70 leading-none">· {currentTool}</span> : null}
        {last ? <span className="normal-case font-normal opacity-60 leading-none">· {ageLabel}</span> : null}
      </span>
    );
  }
  const styles: Record<Exclude<EnvelopeState, "running">, string> = {
    queued: "bg-slate-700/50  text-slate-300 border-slate-600/40",
    done:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    error:  "bg-red-500/15     text-red-300   border-red-500/30",
  };
  const labels: Record<Exclude<EnvelopeState, "running">, string> = {
    queued: "Queued",
    done: "Done",
    error: "Error",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium leading-none uppercase tracking-wider border ${styles[state]}`}>
      {labels[state]}
    </span>
  );
}

function AgentPicker({
  selected,
  rows,
  onSelect,
  order,
  unread,
  resolveSeed,
}: {
  selected: AgentName;
  rows: MessageRow[];
  onSelect: (a: AgentName) => void;
  order: AgentName[];
  unread: Partial<Record<AgentName, number>>;
  resolveSeed: (slug: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const meta = AGENT_META[selected];
  const counts = useMemo(() => {
    const c: Record<AgentName, number> = { switchboard: 0, ava: 0, mia: 0, ash: 0, overseer: 0, me: 0 };
    for (const r of rows) c[r.agent]++;
    return c;
  }, [rows]);

  return (
    <div ref={ref} className="relative w-full">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/60 hover:border-slate-600 transition-colors"
      >
        <PixelAvatar seed={resolveSeed(selected)} size={24} />
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${meta.dot}`} />
        <div className="flex-1 text-left min-w-0">
          <div className={`text-sm font-semibold ${meta.color}`}>{meta.name}</div>
          <div className="text-[10px] text-slate-500 tracking-wider uppercase truncate">{meta.subtitle}</div>
        </div>
        {(() => {
          const total = Object.values(unread).reduce<number>((s, n) => s + (n || 0), 0);
          return total > 0 ? (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold animate-pulse">{total}</span>
          ) : null;
        })()}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div className="absolute top-full left-0 mt-2 w-full rounded-xl border border-slate-700/60 bg-slate-900/95 backdrop-blur shadow-2xl overflow-hidden z-30">
          {order.map((a) => {
            const m = AGENT_META[a];
            const isSel = a === selected;
            const u = unread[a] || 0;
            return (
              <button
                key={a}
                onClick={() => { onSelect(a); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-800/60 transition-colors ${isSel ? "bg-slate-800/40" : ""}`}
              >
                <PixelAvatar seed={resolveSeed(a)} size={24} />
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${m.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${m.color} flex items-center gap-2`}>
                    {m.name}
                    {u > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold animate-pulse">{u}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 tracking-wider uppercase truncate">{m.subtitle}</div>
                </div>
                <span className="text-[10px] text-slate-600 flex-shrink-0">{counts[a]} msg</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// Reply icon — sits to the left of the copy icon. Clicking prefills the
// composer with the message quoted as `> snippet\n\n` so Nathan can write his
// reply directly underneath. No backend change — the quote travels in the
// outgoing message text.
function ReplyButton({ text, author, onReply }: { text: string; author: string; onReply: (snippet: string, author: string) => void }) {
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReply(text, author);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title="Reply to this message"
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-700/50 opacity-70 hover:opacity-100 transition-opacity"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 17 4 12 9 7" />
        <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
      </svg>
    </button>
  );
}

// Build a `> quoted...` block from a message snippet. Truncates long snippets
// to keep the composer manageable; the user can always edit further.
function quoteSnippet(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const short = trimmed.length > 240 ? trimmed.slice(0, 240).trimEnd() + "…" : trimmed;
  return short.split("\n").map((l) => `> ${l}`).join("\n");
}

function MessageActions({ text, author, onReply }: { text: string; author: string; onReply: (snippet: string, author: string) => void }) {
  return (
    <div className="mb-1 flex items-center justify-end gap-0.5 rounded-lg opacity-65 transition-opacity group-hover:opacity-100">
      <ReplyButton text={text} author={author} onReply={onReply} />
      <CopyButton text={text} />
    </div>
  );
}

// Build a single-line excerpt for the inline `> **author:** snippet` quote that
// gets prepended to the outgoing message body.
function buildReplyQuote(author: string, snippet: string): string {
  const oneLine = snippet.replace(/\s+/g, " ").trim();
  if (!oneLine) return "";
  const short = oneLine.length > 180 ? oneLine.slice(0, 180).trimEnd() + "…" : oneLine;
  return `> **${author}:** ${short}`;
}

function ReplyPreview({ author, snippet, onCancel }: { author: string; snippet: string; onCancel: () => void }) {
  const oneLine = snippet.replace(/\s+/g, " ").trim();
  const short = oneLine.length > 140 ? oneLine.slice(0, 140).trimEnd() + "…" : oneLine;
  return (
    <div className="mb-2 flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs text-slate-200">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-300">
        <polyline points="9 17 4 12 9 7" />
        <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
      </svg>
      <span className="text-indigo-300">Replying to</span>
      <span className="font-semibold text-indigo-200">{author}</span>
      <span className="truncate text-slate-400 italic">{short}</span>
      <button
        type="button"
        onClick={onCancel}
        title="Cancel reply"
        className="ml-auto flex-shrink-0 h-5 w-5 inline-flex items-center justify-center rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700/50"
      >
        ✕
      </button>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* clipboard blocked */ }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={copied ? "Copied" : "Copy"}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-700/50 opacity-70 hover:opacity-100 transition-opacity"
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}


type Attachment = { name: string; path: string; size: number; mime: string; localPreview?: string };

export default function AgentsClient({ initialRows = [] }: { initialRows?: MessageRow[] } = {}) {
  const { me, loaded } = useMe();
  // me is server-rendered into MeProvider, so usually available on first paint.
  // Show empty shell only if we genuinely have no user resolution yet.
  if (!loaded) {
    return <div className="fixed inset-x-0 top-0 bottom-[56px] md:bottom-0 md:left-52 bg-[#0a0a0a]" />;
  }
  if (!me) {
    return <div className="fixed inset-x-0 top-0 bottom-[56px] md:bottom-0 md:left-52 bg-[#0a0a0a]" />;
  }
  const username = me.username;
  const avatarSeed = me.avatarSeed || `user:${username || "me"}`;
  const agentSeedOverrides = me.agentAvatarSeeds || {};
  const agentName = me.agentName ?? null;
  // Single-agent model: every user (including admin) gets one per-user agent.
  // The legacy AdminAgentsClient grid was Allhart-specific (Ava/Mia/Ash/Overseer)
  // and lives below as dead code until a future cleanup removes it entirely.
  void username;
  return <UserAgentChat agentName={agentName || "Your agent"} userSeed={avatarSeed} agentSeedOverrides={agentSeedOverrides} initialRows={initialRows} />;
}

function AdminAgentsClient({ userSeed, username, agentSeedOverrides, initialRows = [] }: { userSeed: string; username: string; agentSeedOverrides: Record<string,string>; initialRows?: MessageRow[] }) {
  const resolveAgentSeed = (slug: string) => agentSeedOverrides[slug.toLowerCase()] || agentAvatarSeed(slug);
  const agentOrder = useMemo(
    () => AGENT_ORDER.filter(a => !(username === "nathan" && (a === "mia" || a === "switchboard"))),
    [username]
  );
  const [rows, setRows] = useState<MessageRow[]>(initialRows);
  const [polling, setPolling] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const [selected, setSelectedRaw] = useState<AgentName>("ash");
  // Hydrate last-selected agent from localStorage on first render
  useEffect(() => {
    try {
      const v = window.localStorage.getItem("mc-agents-last-selected") as AgentName | null;
      if (v && ["ava", "mia", "ash", "overseer", "switchboard"].includes(v)) setSelectedRaw(v);
    } catch { /* ignore */ }
  }, []);
  const [unread, setUnread] = useState<Partial<Record<AgentName, number>>>({});
  const setSelected = useCallback((a: AgentName) => {
    setSelectedRaw(a);
    setUnread(prev => ({ ...prev, [a]: 0 }));
    try { window.localStorage.setItem("mc-agents-last-selected", a); } catch { /* ignore */ }
  }, []);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  // Pipeline call mode (Pass 1) — STT → Claude → TTS, free, all agents
  type CallStatus = "idle" | "listening" | "speaking-detected" | "transcribing" | "thinking" | "speaking";
  const [inCall, setInCall] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const voiceRecognitionRef = useRef<any | null>(null);
  const voiceSpeechBufferRef = useRef("");
  const voiceChunkTextRef = useRef("");
  const voiceChunkPromisesRef = useRef<Promise<void>[]>([]);
  const voiceChunkSeqRef = useRef(0);
  const voiceLiveSttInFlightRef = useRef(false);
  const [voiceLiveTranscript, setVoiceLiveTranscript] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  useAutogrowTextarea(composerRef, text);
  const [replyTo, setReplyTo] = useState<{ author: string; snippet: string } | null>(null);
  const onReply = useCallback((snippet: string, author: string) => {
    setReplyTo({ author, snippet });
    setTimeout(() => composerRef.current?.focus(), 0);
  }, []);
  // Pipeline-call refs
  const callStreamRef = useRef<MediaStream | null>(null);
  const callRecorderRef = useRef<MediaRecorder | null>(null);
  const callChunksRef = useRef<Blob[]>([]);
  const callAudioCtxRef = useRef<AudioContext | null>(null);
  const callAnalyserRef = useRef<AnalyserNode | null>(null);
  const callVadFrameRef = useRef<number | null>(null);
  const callPlayerRef = useRef<HTMLAudioElement | null>(null);
  const callActiveRef = useRef(false);
  const callSeenCorrIdsRef = useRef<Set<string>>(new Set());
  const callRecognitionRef = useRef<any | null>(null);
  const callSpeechBufferRef = useRef("");
  const callChunkTextsRef = useRef<string[]>([]);
  const callChunkPromisesRef = useRef<Promise<void>[]>([]);
  const callChunkSeqRef = useRef(0);
  const callLiveSttInFlightRef = useRef(false);
  const callStreamingCtxRef = useRef<AudioContext | null>(null);
  const callStreamReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const callLiveTranscriptRef = useRef("");
  // Speculative-fetch refs (fire at 700ms silence; commit at 1500ms; abort if user resumes)
  const callSpecAbortRef = useRef<AbortController | null>(null);
  const callSpecPromiseRef = useRef<Promise<void> | null>(null);
  const callSpecCommitResolveRef = useRef<(() => void) | null>(null);
  const callSpecFiredRef = useRef(false);
  const callSpecCommittedRef = useRef(false);
  const callSpecUtteranceRef = useRef("");
  // Per-turn id; both speculative and non-speculative POSTs of the same turn
  // share it so the server can dedupe inbound-history writes (otherwise a
  // spec-then-abort-then-non-spec sequence appends Nathan's utterance twice).
  const callTurnIdRef = useRef("");
  const callWakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [callLiveTranscript, setCallLiveTranscript] = useState("");
  // Per-row toggle for the in-flight tool-use disclosure (the "+"/"−" button next to Stop).
  // Keyed by corr_id; absent or false = collapsed (pill only), true = show one-line snippet.
  const [toolDisclosure, setToolDisclosure] = useState<Record<string, boolean>>({});
  const toggleToolDisclosure = useCallback((corrId: string) => {
    setToolDisclosure((prev) => ({ ...prev, [corrId]: !prev[corrId] }));
  }, []);
  // Ticking clock so the running-state pill re-colours green→yellow→red as the
  // gap between now and last_event_ts grows, even between data polls.
  // Only ticks while at least one row is in "running" state, to avoid
  // wasted renders on idle screens.
  const hasRunning = rows.some((r) => r.agent_state === "running");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!hasRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasRunning]);

  // Per-bubble expansion state for the "Thinking" inspector. A Set of corr_ids
  // that are currently expanded. Persisted to localStorage so it survives reloads.
  const [expandedThoughts, setExpandedThoughts] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const v = window.localStorage.getItem("mc-agents-expanded-thoughts");
      if (v) setExpandedThoughts(new Set(JSON.parse(v) as string[]));
    } catch { /* localStorage unavailable */ }
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem("mc-agents-expanded-thoughts", JSON.stringify(Array.from(expandedThoughts))); } catch { /* ignore */ }
  }, [expandedThoughts]);
  const toggleExpanded = useCallback((corrId: string) => {
    setExpandedThoughts((prev) => {
      const next = new Set(prev);
      if (next.has(corrId)) next.delete(corrId);
      else next.add(corrId);
      return next;
    });
  }, []);

  // Activity toasts: flash a brief icon+label up the screen whenever an agent
  // saves to memory, writes to the wiki, or updates a skill.
  type Toast = { id: number; kind: "memory" | "wiki" | "skill" | "delegate"; text: string; agent: AgentName };
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seenActivityRef = useRef<Set<string>>(new Set());
  const toastIdRef = useRef(0);
  useEffect(() => {
    // First pass on mount: mark all current activity as seen so we don't toast historic items
    if (seenActivityRef.current.size === 0 && rows.length > 0) {
      for (const r of rows) {
        for (const f of r.memory_saved || []) seenActivityRef.current.add(`${r.corr_id}:m:${f}`);
        for (const f of r.wiki_saved || []) seenActivityRef.current.add(`${r.corr_id}:w:${f}`);
        for (const f of r.skills_saved || []) seenActivityRef.current.add(`${r.corr_id}:s:${f}`);
        for (const d of r.delegations || []) seenActivityRef.current.add(`${r.corr_id}:d:${d.corr_id}`);
      }
      return;
    }
    const newToasts: Toast[] = [];
    const me = (username || "").toLowerCase();
    for (const r of rows) {
      // Activity toasts are personal — admin sees other users' rows in the
      // table, but we only flash toasts for the current user's own agent.
      if (((r.user || "nathan").toLowerCase()) !== me) continue;
      for (const f of r.memory_saved || []) {
        const k = `${r.corr_id}:m:${f}`;
        if (!seenActivityRef.current.has(k)) { seenActivityRef.current.add(k); newToasts.push({ id: ++toastIdRef.current, kind: "memory", text: f, agent: r.agent }); }
      }
      for (const f of r.wiki_saved || []) {
        const k = `${r.corr_id}:w:${f}`;
        if (!seenActivityRef.current.has(k)) { seenActivityRef.current.add(k); newToasts.push({ id: ++toastIdRef.current, kind: "wiki", text: f, agent: r.agent }); }
      }
      for (const f of r.skills_saved || []) {
        const k = `${r.corr_id}:s:${f}`;
        if (!seenActivityRef.current.has(k)) { seenActivityRef.current.add(k); newToasts.push({ id: ++toastIdRef.current, kind: "skill", text: f, agent: r.agent }); }
      }
      for (const d of r.delegations || []) {
        const k = `${r.corr_id}:d:${d.corr_id}`;
        if (!seenActivityRef.current.has(k)) { seenActivityRef.current.add(k); newToasts.push({ id: ++toastIdRef.current, kind: "delegate", text: `→ ${d.to}: ${d.task}`, agent: r.agent }); }
      }
    }
    if (newToasts.length === 0) return;
    setToasts((prev) => [...prev, ...newToasts]);
    // Auto-remove after 4s
    for (const t of newToasts) {
      setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== t.id)), 4000);
    }
  }, [rows]);

  // Soft chime when an agent's turn flips to `done` while the MC tab isn't
  // the active window. Mirrors Discord — quiet when you're looking, audible
  // when you're not. Synthesised via Web Audio API so there's no asset to
  // ship; tone is a two-step "ding" (~250ms total) intentionally below the
  // typical notification volume so it doesn't startle.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const notifiedDoneRef = useRef<Set<string>>(new Set());
  const playChime = useCallback(() => {
    try {
      let ctx = audioCtxRef.current;
      if (!ctx) {
        const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
          || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        ctx = new Ctor();
        audioCtxRef.current = ctx;
      }
      if (ctx.state === "suspended") { ctx.resume().catch(() => {}); }
      const now = ctx.currentTime;
      const tone = (freq: number, t0: number, dur: number, peak: number) => {
        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ctx!.destination);
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(peak, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.start(t0);
        osc.stop(t0 + dur);
      };
      tone(880, now, 0.25, 0.05);
      tone(1318.5, now + 0.08, 0.25, 0.04);
    } catch { /* audio blocked or unsupported */ }
  }, []);
  useEffect(() => {
    // First pass on mount: snapshot all currently-done rows as "already
    // notified" so historic completions don't ding when the tab opens.
    if (notifiedDoneRef.current.size === 0 && rows.length > 0) {
      for (const r of rows) {
        if (r.agent_state === "done") notifiedDoneRef.current.add(r.corr_id);
      }
      return;
    }
    for (const r of rows) {
      if (r.agent_state !== "done") continue;
      if (notifiedDoneRef.current.has(r.corr_id)) continue;
      notifiedDoneRef.current.add(r.corr_id);
      if (typeof document !== "undefined" && document.hidden) {
        playChime();
      }
    }
  }, [rows, playChime]);

  // Per-agent unread tracking. New agent_text on a non-selected agent → bump.
  const seenAgentMsgRef = useRef<Set<string>>(new Set());
  const seenSeededRef = useRef(false);
  useEffect(() => {
    if (!seenSeededRef.current) {
      if (rows.length === 0) return;
      seenSeededRef.current = true;
      for (const r of rows) if (r.agent_text) seenAgentMsgRef.current.add(r.corr_id);
      return;
    }
    const bumps: Partial<Record<AgentName, number>> = {};
    for (const r of rows) {
      if (!r.agent_text) continue;
      if (seenAgentMsgRef.current.has(r.corr_id)) continue;
      seenAgentMsgRef.current.add(r.corr_id);
      if (r.agent === selected) continue;
      bumps[r.agent] = (bumps[r.agent] || 0) + 1;
    }
    if (Object.keys(bumps).length === 0) return;
    setUnread(prev => {
      const next = { ...prev };
      for (const k of Object.keys(bumps) as AgentName[]) next[k] = (next[k] || 0) + (bumps[k] || 0);
      return next;
    });
  }, [rows, selected]);

  // Title flash: prepend "(N⚡) " when unread agent activity is pending.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const total = Object.values(unread).reduce<number>((s, n) => s + (n || 0), 0);
    const base = document.title.replace(/^\(\d+⚡\)\s*/, "");
    document.title = total > 0 ? `(${total}⚡) ${base}` : base;
  }, [unread]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/messages?limit=50", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { rows: MessageRow[] };
      setRows(data.rows || []);
      setLastError(null);
    } catch (e) {
      setLastError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!polling) return;
    // SSE-driven refresh: server pings whenever the outbox changes.
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/agents/messages/stream");
      es.addEventListener("ping", () => { refresh(); });
      es.addEventListener("ready", () => { refresh(); });
    } catch { /* fall back to interval below */ }
    // Long-interval safety net in case SSE drops or never connects.
    const id = setInterval(refresh, 30_000);
    return () => { es?.close(); clearInterval(id); };
  }, [refresh, polling]);

  const filtered = useMemo(() => rows.filter((r) => r.agent === selected), [rows, selected]);

  // Land at the last message synchronously (before paint) on agent switch /
  // first mount / first time rows arrive — no visible scroll animation. Subsequent
  // new messages within the same agent get a smooth scroll as visual feedback.
  const isFirstScrollRef = useRef(true);
  // "Near bottom" tracking — auto-scroll only fires when the user was already
  // near the bottom. If they scrolled up to read history, don't yank them down.
  const wasNearBottomRef = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      wasNearBottomRef.current = distFromBottom < 120;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    isFirstScrollRef.current = true;
    wasNearBottomRef.current = true;
  }, [selected]);
  // Fingerprint tracks anything that changes the bubble heights — new rows AND
  // existing-row text growing as the agent's reply fills in. Length-only check
  // missed the second case (running → done same row), so the bubble would grow
  // off-screen without auto-scroll firing.
  const contentFingerprint = useMemo(
    () => filtered.map((r) => `${r.corr_id}:${r.agent_state || ""}:${(r.agent_text || "").length}:${(r.user_text || "").length}`).join("|"),
    [filtered],
  );
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    if (isFirstScrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      if (filtered.length > 0) isFirstScrollRef.current = false;
    } else if (wasNearBottomRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [contentFingerprint, filtered.length]);

  const stopTurn = useCallback(async (corrId: string, agent: AgentName) => {
    try {
      const res = await fetch(`/api/agents/${agent}/stop`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ corr_id: corrId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSendError(err.error || `stop failed: HTTP ${res.status}`);
        return;
      }
      await refresh();
    } catch (e) {
      setSendError((e as Error).message);
    }
  }, [refresh]);

  const handleSend = useCallback(async () => {
    const raw = text.trim();
    const quote = replyTo ? buildReplyQuote(replyTo.author, replyTo.snippet) : "";
    const t = quote ? (raw ? `${quote}\n\n${raw}` : quote) : raw;
    if ((!t && attachments.length === 0) || sending) return;
    const matched = detectKeywords(t);
    if (matched.length > 0) {
      const ok = window.confirm(`This message contains sensitive keyword(s): ${matched.join(", ")}\n\nMessage:\n${t}\n\nSend anyway?`);
      if (!ok) return;
    }
    setSending(true);
    setSendError(null);
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 60_000);
    try {
      const res = await fetch(`/api/agents/${selected}/enqueue`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: t,
          confirmed: true,
          attachments: attachments.map((a) => ({ name: a.name, path: a.path, mime: a.mime, size: a.size })),
        }),
        signal: ctrl.signal,
      });
      if (res.status === 401) {
        setSendError("Session expired — please refresh and log in again.");
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setText("");
      setAttachments([]);
      setReplyTo(null);
      await refresh();
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") {
        setSendError("Send timed out after 60s — server may be restarting. Try again, or refresh the page.");
      } else {
        setSendError(err.message);
      }
    } finally {
      clearTimeout(timeoutId);
      setSending(false);
    }
  }, [text, attachments, sending, selected, refresh, replyTo]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    const fd = new FormData();
    for (const f of arr) fd.append("files", f);
    setSendError(null);
    try {
      const res = await fetch("/api/agents/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { files: Attachment[] };
      const withPreview = data.files.map((f, i) => ({
        ...f,
        localPreview: arr[i] && arr[i].type.startsWith("image/") ? URL.createObjectURL(arr[i]) : undefined,
      }));
      setAttachments((prev) => [...prev, ...withPreview]);
    } catch (e) {
      setSendError((e as Error).message);
    }
  }, []);

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => {
      const a = prev[idx];
      if (a?.localPreview) URL.revokeObjectURL(a.localPreview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // ─── Pipeline call mode (STT → Claude → TTS) ───────────────────────────
  const stopCallTracks = useCallback(() => {
    if (callVadFrameRef.current != null) {
      cancelAnimationFrame(callVadFrameRef.current);
      callVadFrameRef.current = null;
    }
    try { callRecorderRef.current?.state !== "inactive" && callRecorderRef.current?.stop(); } catch { /* ignore */ }
    callStreamRef.current?.getTracks().forEach((t) => t.stop());
    callStreamRef.current = null;
    callRecorderRef.current = null;
    callAnalyserRef.current = null;
    try { callRecognitionRef.current?.stop?.(); } catch { /* ignore */ }
    callRecognitionRef.current = null;
    if (callAudioCtxRef.current && callAudioCtxRef.current.state !== "closed") {
      callAudioCtxRef.current.close().catch(() => {});
    }
    callAudioCtxRef.current = null;
  }, []);

  const startListeningTurn = useCallback(async () => {
    if (!callActiveRef.current) return;
    setCallStatus("listening");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      callStreamRef.current = stream;
      const ctx = new AudioContext();
      callAudioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      callAnalyserRef.current = analyser;

      // Fast path: browser speech recognition produces interim/final text while
      // Nathan is talking, so we can often skip the slower upload→STT step.
      callSpeechBufferRef.current = "";
      callChunkTextsRef.current = [];
      callChunkPromisesRef.current = [];
      callChunkSeqRef.current = 0;
      callLiveSttInFlightRef.current = false;
      callLiveTranscriptRef.current = "";
      setCallLiveTranscript("");
      callSpecAbortRef.current = null;
      callSpecPromiseRef.current = null;
      callSpecCommitResolveRef.current = null;
      callSpecFiredRef.current = false;
      callSpecCommittedRef.current = false;
      callSpecUtteranceRef.current = "";
      callTurnIdRef.current = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionCtor) {
        try {
          const recognition = new SpeechRecognitionCtor();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = "en-AU";
          recognition.onresult = (event: any) => {
            let finalText = "";
            let interimText = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const transcript = event.results[i][0]?.transcript || "";
              if (event.results[i].isFinal) finalText += transcript;
              else interimText += transcript;
            }
            if (finalText.trim()) {
              callSpeechBufferRef.current = `${callSpeechBufferRef.current} ${finalText}`.trim();
            }
            const live = `${callSpeechBufferRef.current} ${interimText}`.trim();
            callLiveTranscriptRef.current = live;
            setCallLiveTranscript(live);
          };
          recognition.onerror = () => { /* fall back to local STT */ };
          recognition.start();
          callRecognitionRef.current = recognition;
        } catch { /* fall back to local STT */ }
      }

      // Speculative streaming-call: decode audio chunks as they arrive but
      // gate playback on commitPromise. This lets us fire the request at 700ms
      // silence (head start), and only play audio once VAD trips real end-of-turn.
      const runStreamingCall = async (utterance: string, signal: AbortSignal, commitPromise: Promise<void>) => {
        // All agents (including Switchboard) use server ash-tts (Sonia) for voice quality.
        const audioCtx = new AudioContext();
        callStreamingCtxRef.current = audioCtx;
        let playHead = 0;
        let committed = false;
        const decodedQueue: AudioBuffer[] = [];
        const playBuffer = (b: AudioBuffer) => {
          if (!audioCtx) return;
          const src = audioCtx.createBufferSource();
          src.buffer = b;
          src.connect(audioCtx.destination);
          const startAt = Math.max(audioCtx.currentTime, playHead);
          src.start(startAt);
          playHead = startAt + b.duration;
        };
        commitPromise.then(() => {
          committed = true;
          while (decodedQueue.length) playBuffer(decodedQueue.shift()!);
        });
        const queueAudio = async (b64: string) => {
          try {
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            const buffer = await audioCtx.decodeAudioData(bytes.buffer.slice(0));
            if (committed) playBuffer(buffer);
            else decodedQueue.push(buffer);
          } catch (e) {
            console.warn("audio chunk decode failed:", e);
          }
        };
        const res = await fetch(`/api/agents/${selected}/stream-call`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: utterance, turn_id: callTurnIdRef.current }),
          signal,
        });
        if (!res.ok || !res.body) throw new Error(`stream-call ${res.status}`);
        const reader = res.body.getReader();
        callStreamReaderRef.current = reader;
        const dec = new TextDecoder();
        let buf = "";
        outer: while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!callActiveRef.current) {
            try { reader.cancel(); } catch { /* ignore */ }
            break;
          }
          buf += dec.decode(value, { stream: true });
          const events = buf.split(/\n\n/);
          buf = events.pop() || "";
          for (const block of events) {
            let evtName = "message", dataLine = "";
            for (const line of block.split("\n")) {
              if (line.startsWith("event:")) evtName = line.slice(6).trim();
              else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
            }
            if (!dataLine) continue;
            let data: { partial?: string; mime?: string; data?: string; text?: string; error?: string };
            try { data = JSON.parse(dataLine); } catch { continue; }
            if (evtName === "audio" && data.data) {
              await queueAudio(data.data);
            } else if (evtName === "text" && data.partial) {
              // text events are informational — audio chunks carry the spoken reply
            } else if (evtName === "done") {
              break outer;
            } else if (evtName === "error") {
              setSendError(`stream: ${data.error || "unknown"}`);
              break outer;
            }
          }
        }
        callStreamReaderRef.current = null;
        // Make sure commit has happened (caller resolves it on VAD end-of-turn).
        await commitPromise;
        // Drain any decoded-but-not-yet-played
        while (decodedQueue.length) playBuffer(decodedQueue.shift()!);
        const remaining = Math.max(0, playHead - audioCtx.currentTime);
        if (remaining > 0) await new Promise((r) => setTimeout(r, (remaining + 0.05) * 1000));
        await audioCtx.close().catch(() => {});
        callStreamingCtxRef.current = null;
        await refresh();
      };

      const mr = new MediaRecorder(stream);
      callChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size <= 0) return;
        callChunksRef.current.push(e.data);
        if (callLiveSttInFlightRef.current) return;
        const snapshot = new Blob(callChunksRef.current, { type: mr.mimeType || "audio/webm" });
        const seq = ++callChunkSeqRef.current;
        callLiveSttInFlightRef.current = true;
        const promise = (async () => {
          try {
            const fd = new FormData();
            fd.append("audio", snapshot, "live.webm");
            const res = await fetch("/api/agents/transcribe", { method: "POST", body: fd });
            if (!res.ok) return;
            const data = (await res.json()) as { text: string };
            const chunkText = (data.text || "").trim();
            if (!chunkText || !callActiveRef.current || seq < callChunkSeqRef.current) return;
            callChunkTextsRef.current = [chunkText];
            const combined = `${callSpeechBufferRef.current} ${chunkText}`.trim();
            if (combined) {
              // Keep ref in sync with displayed transcript — spec-fire snapshot
              // and drift-abort check both read this ref. If browser SR lags
              // and only chunk STT has the tail, the ref must include it or
              // we'll commit a stale early-portion-of-utterance.
              if (combined.length > callLiveTranscriptRef.current.length) {
                callLiveTranscriptRef.current = combined;
              }
              setCallLiveTranscript(combined);
            }
          } catch { /* live STT is best-effort */ }
          finally { callLiveSttInFlightRef.current = false; }
        })();
        callChunkPromisesRef.current.push(promise);
      };
      mr.onstop = async () => {
        const blob = new Blob(callChunksRef.current, { type: mr.mimeType || "audio/webm" });
        callChunksRef.current = [];
        if (callVadFrameRef.current != null) {
          cancelAnimationFrame(callVadFrameRef.current);
          callVadFrameRef.current = null;
        }
        // Snapshot live transcript BEFORE stopping recognition — Chrome's
        // SpeechRecognition can drop trailing interim text on stop() if it
        // can't confidently finalize it, so the pre-stop snapshot is often
        // longer than the post-stop one. Take whichever is longer.
        const preStopLive = (callLiveTranscriptRef.current || callSpeechBufferRef.current).trim();
        const rec = callRecognitionRef.current;
        if (rec) {
          // Pre-stop settle: let any in-flight onresult event land before we
          // call stop() — Chrome truncates if stop() interrupts a result.
          await new Promise((r) => setTimeout(r, 250));
          await new Promise<void>((resolve) => {
            let done = false;
            const finish = () => { if (!done) { done = true; resolve(); } };
            try { rec.onend = finish; } catch { /* ignore */ }
            try { rec.stop(); } catch { finish(); }
            setTimeout(finish, 800);
          });
        }
        const postStopLive = (callLiveTranscriptRef.current || callSpeechBufferRef.current).trim();
        const liveSnapshot = postStopLive.length >= preStopLive.length ? postStopLive : preStopLive;
        callStreamRef.current?.getTracks().forEach((t) => t.stop());
        callStreamRef.current = null;
        callRecorderRef.current = null;
        callAnalyserRef.current = null;
        callRecognitionRef.current = null;
        if (callAudioCtxRef.current && callAudioCtxRef.current.state !== "closed") {
          callAudioCtxRef.current.close().catch(() => {});
        }
        callAudioCtxRef.current = null;
        try {
          // Speculative path: a request was already fired at 700ms silence.
          // VAD has resolved the commit promise, so audio is now playing.
          if (callSpecPromiseRef.current) {
            setCallStatus("speaking");
            await callSpecPromiseRef.current;
            callSpecPromiseRef.current = null;
            callSpecAbortRef.current = null;
            callSpecCommitResolveRef.current = null;
            callSpecFiredRef.current = false;
            callSpecCommittedRef.current = false;
            callSpeechBufferRef.current = "";
            callChunkTextsRef.current = [];
            callChunkPromisesRef.current = [];
            callChunkSeqRef.current = 0;
            callLiveSttInFlightRef.current = false;
            if (callActiveRef.current) startListeningTurn();
            return;
          }
          // Non-speculative fallback (Ash, or speculative was aborted/never fired)
          setCallStatus("transcribing");
          if (!liveSnapshot && (blob.size === 0 || !callActiveRef.current)) {
            if (callActiveRef.current) startListeningTurn();
            return;
          }
          const liveCandidate = liveSnapshot;
          const chunkCandidate = (callChunkTextsRef.current[0] || "").trim();
          let finalSttCandidate = "";
          const liveLooksCasual = selected === "ash" && isAshCasualVoiceOnly(liveCandidate);
          // Android Chrome/browser live speech can show a plausible-but-wrong
          // transcript. For committed Ash phone turns, use live text as a fast
          // preview only, then run one full-turn local STT pass and choose the
          // fullest transcript before enqueueing. Exception: exact casual Ash
          // greetings stay instant and skip the slower final STT pass.
          if (!liveLooksCasual && blob.size > 0) {
            try {
              const fd = new FormData();
              fd.append("audio", blob, "call.webm");
              const sttRes = await fetch("/api/agents/transcribe", { method: "POST", body: fd });
              if (sttRes.ok) {
                const sttData = (await sttRes.json()) as { text: string };
                finalSttCandidate = (sttData.text || "").trim();
              }
            } catch { /* keep live/chunk transcript */ }
          }
          const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
          let utterance = liveCandidate || chunkCandidate || finalSttCandidate;
          for (const candidate of [finalSttCandidate, chunkCandidate, liveCandidate]) {
            if (candidate && wordCount(candidate) >= Math.max(1, wordCount(utterance) - 1)) {
              utterance = candidate;
              break;
            }
          }
          setCallLiveTranscript(utterance);
          callSpeechBufferRef.current = "";
          callChunkTextsRef.current = [];
          callChunkPromisesRef.current = [];
          callChunkSeqRef.current = 0;
          callLiveSttInFlightRef.current = false;
          if (!utterance) {
            if (callActiveRef.current) startListeningTurn();
            return;
          }
          setCallStatus("thinking");
          if (selected === "ash") {
            let replyText: string | undefined;
            if (isAshCasualVoiceOnly(utterance)) {
              // Phone calls are for quick conversation. Don't burn a full Hermes
              // turn just to answer "good morning".
              replyText = ashCasualVoiceReply(utterance);
            } else {
              const taskLike = isAshVoiceTaskRequest(utterance);
              const enqRes = await fetch(`/api/agents/${selected}/enqueue`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ text: utterance, confirmed: true, thread_id: "voice-call" }),
              });
              if (!enqRes.ok) throw new Error(`enqueue ${enqRes.status}`);
              const enqData = (await enqRes.json()) as { corr_id: string };
              const corrId = enqData.corr_id;

              if (taskLike) {
                // Real work belongs in the MC text job. Voice should acknowledge
                // immediately instead of waiting for task completion.
                replyText = "Got it — I’ll work on that in MC.";
              } else {
                const start = Date.now();
                const MAX_REPLY_WAIT_MS = 30_000;
                while (Date.now() - start < MAX_REPLY_WAIT_MS) {
                  await new Promise((r) => setTimeout(r, 700));
                  if (!callActiveRef.current) return;
                  const mres = await fetch("/api/agents/messages?limit=50", { cache: "no-store" });
                  if (!mres.ok) continue;
                  const md = (await mres.json()) as { rows: MessageRow[] };
                  const row = md.rows.find((r) => r.corr_id === corrId);
                  if (row && (row.agent_state === "done" || row.agent_state === "error")) {
                    replyText = row.agent_text || row.error || "(no reply)";
                    break;
                  }
                }
                if (!replyText) {
                  // If a non-task voice reply can't happen quickly, cancel it.
                  await fetch(`/api/agents/${selected}/stop`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ corr_id: corrId }),
                  }).catch(() => {});
                  replyText = "I’m taking too long, so I cancelled that one.";
                }
              }
              await refresh();
            }
            setCallStatus("speaking");
            const ttsRes = await fetch("/api/agents/tts", {
              method: "POST", headers: { "content-type": "application/json" },
              body: JSON.stringify({ text: replyText, voice: "en-GB-SoniaNeural" }),
            });
            if (!ttsRes.ok) throw new Error(`tts ${ttsRes.status}`);
            const ab = await ttsRes.arrayBuffer();
            const url = URL.createObjectURL(new Blob([ab], { type: "audio/mpeg" }));
            const audio = new Audio(url);
            audio.setAttribute("playsinline", "true"); audio.autoplay = true;
            callPlayerRef.current = audio;
            await audio.play().catch(() => {});
            await new Promise<void>((resolve) => {
              audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
              audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
            });
          } else {
            // Non-speculative path (e.g. user spoke continuously through the 700ms threshold).
            // Use runStreamingCall with an already-resolved commit promise so audio plays immediately.
            setCallStatus("speaking");
            const ac = new AbortController();
            callSpecAbortRef.current = ac;
            await runStreamingCall(utterance, ac.signal, Promise.resolve());
            callSpecAbortRef.current = null;
          }
          // Loop — listen for the next user turn
          if (callActiveRef.current) startListeningTurn();
        } catch (e) {
          console.error("call turn failed:", e);
          setSendError(`call: ${(e as Error).message}`);
          if (callActiveRef.current) {
            // brief pause then re-listen
            setTimeout(() => callActiveRef.current && startListeningTurn(), 1500);
          }
        }
      };
      callRecorderRef.current = mr;
      mr.start(5000);

      // VAD with speculative pre-fire:
      //   - At SPECULATIVE_FIRE_MS of silence, fire request with current live transcript.
      //     Audio chunks decode immediately but playback is gated on commit.
      //   - If user resumes speaking before COMMIT, abort the speculative request.
      //   - At COMMIT_MS of silence, resolve commit promise (audio plays) + stop recorder.
      const buf = new Uint8Array(analyser.fftSize);
      let lastLoud = Date.now();
      let everSpoke = false;
      const SILENCE_THRESHOLD = 0.04;          // RMS, normalized 0..1
      const SPECULATIVE_FIRE_MS = 1800;        // start the request after this much silence (700 → 1100 → 1800)
      const COMMIT_MS = 5500;                  // end-of-turn (1500 → 2200 → 3500 → 5500 — 3500 still cut Nathan off mid-thought "...so that I can just...")
      const MAX_TURN_MS = 60_000;
      const startTurn = Date.now();

      const loop = () => {
        if (!callActiveRef.current || !callAnalyserRef.current) return;
        callAnalyserRef.current.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        const abortSpec = () => {
          try { callSpecAbortRef.current?.abort(); } catch { /* ignore */ }
          callSpecAbortRef.current = null;
          callSpecPromiseRef.current = null;
          callSpecCommitResolveRef.current = null;
          callSpecFiredRef.current = false;
          callSpecUtteranceRef.current = "";
        };
        if (rms > SILENCE_THRESHOLD) {
          lastLoud = Date.now();
          everSpoke = true;
          if (callStatus === "listening") setCallStatus("speaking-detected");
          // User resumed speaking after a speculative fire — abort.
          if (callSpecFiredRef.current && !callSpecCommittedRef.current) abortSpec();
        }
        // Transcript-growth abort: even if RMS doesn't trigger (soft speech, lagging
        // recognition), if the live transcript has grown noticeably since spec fired,
        // the speculative request is based on stale text — abort and we'll re-fire.
        if (callSpecFiredRef.current && !callSpecCommittedRef.current) {
          const liveNow = (callLiveTranscriptRef.current || callSpeechBufferRef.current).trim();
          if (liveNow.length > callSpecUtteranceRef.current.length + 8) abortSpec();
        }
        const now = Date.now();
        const elapsed = now - startTurn;
        const silenceFor = now - lastLoud;
        // Head-start: fire the request at SPECULATIVE_FIRE_MS so it's already running by COMMIT_MS.
        if (everSpoke && !callSpecFiredRef.current && selected !== "ash" && silenceFor > SPECULATIVE_FIRE_MS) {
          const utteranceSnap = (callLiveTranscriptRef.current || callSpeechBufferRef.current).trim();
          if (utteranceSnap) {
            callSpecFiredRef.current = true;
            callSpecUtteranceRef.current = utteranceSnap;
            const ac = new AbortController();
            callSpecAbortRef.current = ac;
            const commitPromise = new Promise<void>((resolve) => { callSpecCommitResolveRef.current = resolve; });
            setCallStatus("thinking");
            callSpecPromiseRef.current = runStreamingCall(utteranceSnap, ac.signal, commitPromise).catch((e) => {
              if (e?.name !== "AbortError") console.warn("speculative call failed:", e);
            });
          }
        }
        if ((everSpoke && silenceFor > COMMIT_MS) || elapsed > MAX_TURN_MS) {
          // Commit the turn. Pause the VAD loop, then drain any pending final
          // recognition result before the drift check — without this wait the
          // last isFinal onresult (which arrives between stop() and onend) is
          // missed and a stale spec gets committed even though the user kept
          // talking right up to COMMIT_MS.
          const settle = async () => {
            // Snapshot before stop() — Chrome may drop trailing interim text.
            const preStopLive = (callLiveTranscriptRef.current || callSpeechBufferRef.current).trim();
            const rec = callRecognitionRef.current;
            if (rec) {
              callRecognitionRef.current = null;
              // Pre-stop settle: let any in-flight onresult event land before
              // we call stop() — Chrome truncates if stop() interrupts a result.
              await new Promise((r) => setTimeout(r, 250));
              await new Promise<void>((resolve) => {
                let done = false;
                const finish = () => { if (!done) { done = true; resolve(); } };
                try { rec.onend = finish; } catch { /* ignore */ }
                try { rec.stop(); } catch { finish(); }
                setTimeout(finish, 800);
              });
            }
            const postStopLive = (callLiveTranscriptRef.current || callSpeechBufferRef.current).trim();
            const finalLive = postStopLive.length >= preStopLive.length ? postStopLive : preStopLive;
            // Exact-match gate: any divergence between what spec captured at 1.8s
            // and the post-stop final transcript means the spec request was based
            // on a partial — abort and let the non-spec path re-fire with the full
            // liveSnapshot. Previously used a 4-char slop which let small late
            // `isFinal` deliveries commit a stale partial (Nathan: "reads my full
            // transcript but only gives you the first small part").
            if (callSpecFiredRef.current && finalLive !== callSpecUtteranceRef.current) {
              abortSpec();
            } else if (callSpecFiredRef.current) {
              callSpecCommittedRef.current = true;
              try { callSpecCommitResolveRef.current?.(); } catch { /* ignore */ }
            }
            try { callRecorderRef.current?.stop(); } catch { /* ignore */ }
          };
          settle();
          return;
        }
        callVadFrameRef.current = requestAnimationFrame(loop);
      };
      callVadFrameRef.current = requestAnimationFrame(loop);
    } catch (e) {
      setSendError((e as Error).message);
      callActiveRef.current = false;
      setInCall(false);
      setCallStatus("idle");
    }
  }, [selected, stopCallTracks, callStatus, refresh]);

  const startCall = useCallback(() => {
    if (inCall) return;
    callActiveRef.current = true;
    callSeenCorrIdsRef.current = new Set();
    setInCall(true);
    setSendError(null);
    // Acquire screen wake lock so the phone screen doesn't sleep during a call.
    // (Wake Lock is released automatically if the page becomes hidden — we re-acquire on visibilitychange.)
    if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
      (navigator as unknown as { wakeLock: { request: (t: string) => Promise<WakeLockSentinel> } })
        .wakeLock.request("screen")
        .then((sentinel) => { callWakeLockRef.current = sentinel; })
        .catch((e) => console.warn("wake lock failed:", e));
    }
    startListeningTurn();
  }, [inCall, startListeningTurn]);

  const endCall = useCallback(() => {
    callActiveRef.current = false;
    setInCall(false);
    setCallStatus("idle");
    stopCallTracks();
    if (callPlayerRef.current) {
      try { callPlayerRef.current.pause(); } catch { /* ignore */ }
      callPlayerRef.current = null;
    }
    // Kill any in-flight streaming TTS and browser SpeechSynthesis utterances.
    try { callStreamReaderRef.current?.cancel(); } catch { /* ignore */ }
    callStreamReaderRef.current = null;
    if (callStreamingCtxRef.current && callStreamingCtxRef.current.state !== "closed") {
      callStreamingCtxRef.current.close().catch(() => {});
    }
    callStreamingCtxRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
    if (callWakeLockRef.current) {
      try { callWakeLockRef.current.release(); } catch { /* ignore */ }
      callWakeLockRef.current = null;
    }
  }, [stopCallTracks]);

  // Cleanup on unmount
  useEffect(() => () => endCall(), [endCall]);

  // Re-acquire wake lock when tab becomes visible again mid-call OR mid-voice-msg.
  // Browsers release wake locks when the page becomes hidden.
  useEffect(() => {
    if (!inCall && !recording) return;
    const onVisible = () => {
      const stillActive = callActiveRef.current || recording;
      if (document.visibilityState === "visible" && stillActive && !callWakeLockRef.current) {
        if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
          (navigator as unknown as { wakeLock: { request: (t: string) => Promise<WakeLockSentinel> } })
            .wakeLock.request("screen")
            .then((sentinel) => { callWakeLockRef.current = sentinel; })
            .catch(() => { /* ignore */ });
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [inCall, recording]);

  const startRecording = useCallback(async () => {
    if (recording) return;
    setSendError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      voiceSpeechBufferRef.current = "";
      setVoiceLiveTranscript("");
      // Live browser SpeechRecognition for visual feedback + cut-off backstop.
      // If the server STT (ash-stt) result comes back shorter than the live capture,
      // we use the live one — that's the same pattern phone calls use.
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        try {
          const rec = new SR();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = "en-AU";
          rec.onresult = (event: any) => {
            let finalText = "";
            let interimText = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const t = event.results[i][0]?.transcript || "";
              if (event.results[i].isFinal) finalText += t;
              else interimText += t;
            }
            if (finalText.trim()) voiceSpeechBufferRef.current = `${voiceSpeechBufferRef.current} ${finalText}`.trim();
            setVoiceLiveTranscript(`${voiceSpeechBufferRef.current} ${interimText}`.trim());
          };
          rec.onerror = () => { /* fall back to server STT only */ };
          rec.start();
          voiceRecognitionRef.current = rec;
        } catch { /* fall back to server STT only */ }
      }
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        try {
          // Pre-stop settle: let any pending recognition `final` event land.
          await new Promise((r) => setTimeout(r, 250));
          if (voiceRecognitionRef.current) {
            await new Promise<void>((resolve) => {
              let done = false;
              const finish = () => { if (!done) { done = true; resolve(); } };
              try { voiceRecognitionRef.current.onend = finish; } catch { /* ignore */ }
              try { voiceRecognitionRef.current.stop(); } catch { finish(); }
              setTimeout(finish, 800);
            });
            voiceRecognitionRef.current = null;
          }
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
          chunksRef.current = [];
          if (blob.size === 0 && !voiceSpeechBufferRef.current.trim()) return;
          // Async STT (2026-05-05): upload audio, send envelope immediately, let the
          // runner transcribe before calling the model. Net latency is the same but the
          // perceived send is instant — same UX as Discord voice messages.
          setSending(true);
          try {
            // Upload the audio blob to get a stable staging path.
            const upFd = new FormData();
            upFd.append("files", blob, "voice.webm");
            const upRes = await fetch("/api/agents/upload", { method: "POST", body: upFd });
            if (!upRes.ok) {
              const err = await upRes.json().catch(() => ({}));
              throw new Error(err.error || `upload ${upRes.status}`);
            }
            const upData = (await upRes.json()) as { files: { name: string; path: string; mime: string; size: number }[] };
            const audioFile = upData.files?.[0];
            if (!audioFile) throw new Error("upload returned no file");

            // Optional: include the live browser-STT capture as a hint, but the
            // runner-side ash-stt is the authoritative source.
            const liveSnap = voiceSpeechBufferRef.current.trim();
            const draft = text.trim();
            const combined = [draft, liveSnap ? `[voice transcript hint: ${liveSnap}]` : ""].filter(Boolean).join("\n\n");

            const sendRes = await fetch(`/api/agents/${selected}/enqueue`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                text: combined || "[voice message]",
                confirmed: true,
                attachments: [
                  { name: audioFile.name, path: audioFile.path, mime: audioFile.mime, size: audioFile.size },
                  ...attachments.map((a) => ({ name: a.name, path: a.path, mime: a.mime, size: a.size })),
                ],
              }),
            });
            if (!sendRes.ok) {
              const err = await sendRes.json().catch(() => ({}));
              throw new Error(err.error || `HTTP ${sendRes.status}`);
            }
            setText("");
            setAttachments([]);
            setVoiceLiveTranscript("");
            voiceSpeechBufferRef.current = "";
            await refresh();
          } catch (e) {
            setSendError((e as Error).message);
          } finally {
            setSending(false);
          }
        } catch (e) {
          setSendError((e as Error).message);
        }
      };
      recorderRef.current = mr;
      mr.start();
      setRecording(true);
      // Acquire screen wake lock so the phone screen doesn't sleep mid-recording
      // (Android Chrome stops the mic stream when the screen turns off).
      if (typeof navigator !== "undefined" && "wakeLock" in navigator && !callWakeLockRef.current) {
        (navigator as unknown as { wakeLock: { request: (t: string) => Promise<WakeLockSentinel> } })
          .wakeLock.request("screen")
          .then((sentinel) => { callWakeLockRef.current = sentinel; })
          .catch((e) => console.warn("voice msg wake lock failed:", e));
      }
    } catch (e) {
      setSendError((e as Error).message);
    }
  }, [recording, text, attachments, selected, refresh]);

  const stopRecording = useCallback(() => {
    if (!recorderRef.current) return;
    if (recorderRef.current.state !== "inactive") recorderRef.current.stop();
    setRecording(false);
    // Release wake lock if we own one (phone call paths manage their own lifecycle).
    if (callWakeLockRef.current && !inCall) {
      try { callWakeLockRef.current.release(); } catch { /* ignore */ }
      callWakeLockRef.current = null;
    }
  }, [inCall]);

  const onPaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items).filter((it) => it.kind === "file");
    if (items.length === 0) return;
    const files = items.map((it) => it.getAsFile()).filter((f): f is File => !!f);
    if (files.length > 0) {
      e.preventDefault();
      handleFiles(files);
    }
  }, [handleFiles]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    // fixed inset-0 takes the agents page out of normal flow so the body
    // never grows past the viewport. left-52 on desktop respects the sidebar
    // offset added by app/layout.tsx; bottom-16 on mobile leaves room for
    // the bottom nav bar (height pb-16).
    <div className="fixed inset-x-0 top-0 bottom-[56px] md:bottom-0 md:left-52 bg-[#0a0a0a] flex flex-col overflow-hidden">
      {/* Activity toasts: a single bigger card that floats up the centre of the screen */}
      <div className="pointer-events-none fixed inset-x-0 top-1/4 z-50 flex flex-col items-center gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`mc-activity-toast flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold shadow-2xl backdrop-blur border-2 ${
              t.kind === "memory" ? "bg-violet-600/40 border-violet-400/70 text-violet-50 shadow-violet-900/40"
              : t.kind === "wiki" ? "bg-sky-600/40 border-sky-400/70 text-sky-50 shadow-sky-900/40"
              : t.kind === "skill" ? "bg-amber-600/40 border-amber-400/70 text-amber-50 shadow-amber-900/40"
              : "bg-rose-600/40 border-rose-400/70 text-rose-50 shadow-rose-900/40"
            }`}
          >
            {t.kind === "memory" ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
              </svg>
            ) : t.kind === "wiki" ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
            ) : t.kind === "skill" ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2 11 13"/>
                <path d="M22 2 15 22 11 13 2 9 22 2z"/>
              </svg>
            )}
            <span className="flex flex-col leading-tight">
              <span className="text-[10px] uppercase tracking-widest opacity-80">{AGENT_META[t.agent].name} → {t.kind}</span>
              <span className="font-mono text-[12px] opacity-95">{t.kind === "delegate" ? t.text : t.text.split("/").pop()?.replace(/\.md$/, "")}</span>
            </span>
          </div>
        ))}
      </div>
      <style jsx global>{`
        @keyframes mcFadeUp {
          0%   { opacity: 0; transform: translateY(20px) scale(0.95); }
          12%  { opacity: 1; transform: translateY(0) scale(1.04); }
          18%  { transform: translateY(0) scale(1); }
          75%  { opacity: 1; transform: translateY(-30px) scale(1); }
          100% { opacity: 0; transform: translateY(-90px) scale(0.95); }
        }
        .mc-activity-toast {
          animation: mcFadeUp 4s ease-out forwards;
          will-change: transform, opacity;
        }
      `}</style>
      <div className="max-w-[84rem] w-full mx-auto px-3 sm:px-6 pt-2 sm:pt-3 pb-2 flex-1 min-h-0 flex flex-col">
        {/* Top bar — agent picker */}
        <div className="mb-2 flex-shrink-0 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <AgentPicker selected={selected} rows={rows} onSelect={setSelected} order={agentOrder} unread={unread} resolveSeed={resolveAgentSeed} />
          </div>
        </div>

        {/* Single chat window — message list + sticky composer */}
        <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-slate-800/60 bg-slate-950/70 backdrop-blur overflow-hidden">
          <div ref={scrollRef} className="scroll-pretty flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4 min-h-0">
            {filtered.length === 0 ? (
              <div className="text-sm text-slate-500 italic">No messages with {AGENT_META[selected].name} yet — start typing below.</div>
            ) : (
              filtered.map((r) => (
                <div key={r.corr_id} className="space-y-2">
                  {r.user_text || (r.user_attachments && r.user_attachments.length > 0) ? (() => {
                    const visibleText = stripAttachmentTail(r.user_text);
                    return (
                      <div className="flex justify-end items-start gap-2">
                        <div className="group relative max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600/20 border border-indigo-700/30 px-3 py-2 text-sm text-slate-100">
                          {visibleText ? <MessageActions text={visibleText} author="You" onReply={onReply} /> : null}
                          {visibleText ? <div className="whitespace-pre-wrap break-words">{visibleText}</div> : null}
                          {r.user_attachments && r.user_attachments.length > 0 ? <AttachmentList files={r.user_attachments} /> : null}
                          {r.user_ts ? <div className="text-[10px] text-slate-500 mt-1 tabular-nums">{new Date(r.user_ts).toLocaleTimeString()}</div> : null}
                        </div>
                        <PixelAvatar seed={userSeed} size={28} title="You" />
                      </div>
                    );
                  })() : null}
                  <div className="flex justify-start items-start gap-2">
                    <PixelAvatar seed={resolveAgentSeed(r.agent)} size={28} title={AGENT_META[r.agent].name} activity={r.agent_state === "running" ? (r.activity_kind || "thinking") : null} />
                    <div className="group relative max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-800/40 border border-slate-700/30 px-3 py-2 text-sm leading-relaxed text-slate-200">
                      {r.agent_text ? <MessageActions text={r.agent_text} author={AGENT_META[r.agent].name} onReply={onReply} /> : null}
                      <div className="flex items-center gap-2 mb-1">
                        <StateBadge
                          state={r.agent_state}
                          lastEventTs={r.last_event_ts}
                          activityKind={r.activity_kind}
                          currentTool={r.current_tool}
                          now={now}
                        />
                        {(r.agent_state === "queued" || r.agent_state === "running") ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); stopTurn(r.corr_id, r.agent); }}
                            title="Stop this turn"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium leading-none border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-colors"
                          >
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                              <rect x="6" y="6" width="12" height="12" rx="1.5" />
                            </svg>
                            Stop
                          </button>
                        ) : null}
                        {(r.agent_state === "running" && !r.agent_text) ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleToolDisclosure(r.corr_id); }}
                            title={toolDisclosure[r.corr_id] ? "Hide tool detail" : "Show tool detail"}
                            className="text-[14px] leading-none text-slate-400 hover:text-slate-200 transition-colors px-1"
                          >
                            {toolDisclosure[r.corr_id] ? "−" : "+"}
                          </button>
                        ) : null}
                        {(() => {
                          // Live running counter takes precedence over the
                          // post-hoc elapsed_ms (which is only set on done envelopes).
                          // Use agent_ts (running envelope's ts = when the runner
                          // actually spawned claude) so the counter starts at 0s.
                          // Falling back to user_ts produced the "starts at 60s"
                          // bug whenever a queued message had been waiting on
                          // flock for the previous turn to finish.
                          const startTs = r.agent_ts || r.user_ts;
                          if (r.agent_state === "running" && startTs) {
                            const ageS = Math.max(0, Math.floor((now - new Date(startTs).getTime()) / 1000));
                            const label = ageS < 60 ? `${ageS}s` : `${Math.floor(ageS / 60)}m${ageS % 60 ? ` ${ageS % 60}s` : ""}`;
                            return <span className="text-[10px] text-slate-500 ml-auto tabular-nums">{label}</span>;
                          }
                          if (r.elapsed_ms) {
                            return <span className="text-[10px] text-slate-500 ml-auto tabular-nums">{Math.round(r.elapsed_ms / 1000)}s</span>;
                          }
                          return null;
                        })()}
                      </div>
                      {r.agent_text ? (
                        <RichAgentText text={r.agent_text} />
                      ) : r.agent_state === "error" ? (
                        <div className="text-slate-500 italic text-xs">{`Error: ${r.error || "unknown"}`}</div>
                      ) : (r.agent_state === "running" && toolDisclosure[r.corr_id]) ? (() => {
                        // Three-tier disclosure: live tool > sticky last-tool with age > cycling humor.
                        let line: string;
                        if (r.current_tool && r.current_tool_summary) {
                          line = r.current_tool_summary;
                        } else if (r.current_tool_summary && r.current_tool_summary_ts) {
                          const ageS = Math.max(0, Math.floor((now - new Date(r.current_tool_summary_ts).getTime()) / 1000));
                          line = ageS >= 1 ? `${r.current_tool_summary} · ${ageS}s ago` : r.current_tool_summary;
                        } else {
                          // Cycle every 4s so the line feels alive.
                          line = HUMOR_LINES[Math.floor(now / 4000) % HUMOR_LINES.length];
                        }
                        return (
                          <div className="text-slate-400 italic text-xs font-mono truncate" title={line}>
                            {line}
                          </div>
                        );
                      })() : null}
                      {(r.memory_saved && r.memory_saved.length > 0) || (r.wiki_saved && r.wiki_saved.length > 0) || (r.skills_saved && r.skills_saved.length > 0) || (r.delegations && r.delegations.length > 0) ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {/* Delegations: agent-delegate hand-offs render as the legacy compact pill; in-process Task/Agent tool sub-agents render as a roster card with pixel-art avatar + funny reason. See DelegationChip. */}
                          {(r.delegations || []).map((d) => (
                            <DelegationChip key={`d-${d.corr_id}`} d={d} />
                          ))}
                          {(r.memory_saved || []).map((name) => (
                            <span key={`m-${name}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-violet-200 bg-violet-500/15 border border-violet-500/30" title={`Saved to memory: ${name}`}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
                                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
                              </svg>
                              {name.replace(/\.md$/, "")}
                            </span>
                          ))}
                          {(r.wiki_saved || []).map((name) => (
                            <span key={`w-${name}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-sky-200 bg-sky-500/15 border border-sky-500/30" title={`Saved to wiki: ${name}`}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                <polyline points="17 21 17 13 7 13 7 21"/>
                                <polyline points="7 3 7 8 15 8"/>
                              </svg>
                              {name.split("/").pop()?.replace(/\.md$/, "")}
                            </span>
                          ))}
                          {(r.skills_saved || []).map((name) => (
                            <span key={`s-${name}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-amber-200 bg-amber-500/15 border border-amber-500/30" title={`Updated skill: ${name}`}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                              </svg>
                              {name.split("/")[0]}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {r.agent_ts && r.agent_state === "done" ? <div className="text-[10px] text-slate-500 mt-1 tabular-nums">{new Date(r.agent_ts).toLocaleTimeString()}</div> : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div
            className="border-t border-slate-800/60 p-2.5 sm:p-3 flex-shrink-0 bg-slate-950"
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {sendError ? <div className="text-xs text-red-400 mb-2">{sendError}</div> : null}

            {/* Live transcript while recording a voice message */}
            {recording && voiceLiveTranscript ? (
              <div className="mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                <span className="text-emerald-300 font-semibold mr-1">Hearing:</span>
                {voiceLiveTranscript}
              </div>
            ) : recording ? (
              <div className="mb-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300/70 italic">
                Listening… speak naturally; tap the green button to stop.
              </div>
            ) : null}

            {/* Attachment chips */}
            {attachments.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg bg-slate-800/60 border border-slate-700/40 text-xs text-slate-200">
                    {a.localPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.localPreview} alt={a.name} className="w-6 h-6 rounded object-cover" />
                    ) : (
                      <span className="w-6 h-6 rounded bg-slate-700 flex items-center justify-center text-[10px] text-slate-400">F</span>
                    )}
                    <span className="truncate max-w-[120px]">{a.name}</span>
                    <button onClick={() => removeAttachment(i)} className="px-1 text-slate-500 hover:text-slate-200">✕</button>
                  </div>
                ))}
              </div>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,text/plain,.json,.csv,.md,.log"
              className="hidden"
              onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
            />

            {replyTo ? (
              <ReplyPreview author={replyTo.author} snippet={replyTo.snippet} onCancel={() => setReplyTo(null)} />
            ) : null}

            {/* Composer row — full-width textarea with inline icons (Discord-style) */}
            <div className="relative flex items-end bg-slate-900 border border-slate-700/60 rounded-xl focus-within:border-indigo-500/60 transition-colors">
              {/* Attach (paperclip) — small, inside the textarea bar on the left */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
                className="flex-shrink-0 h-9 w-9 flex items-center justify-center text-slate-400 hover:text-slate-100"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
              </button>

              <textarea
                ref={composerRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKey}
                onPaste={onPaste}
                rows={1}
                placeholder={
                  selected === "switchboard"
                    ? "Switchboard is voice-only — tap Phone Switchboard below"
                    : (transcribing ? "Transcribing…" : `Message ${AGENT_META[selected].name}…`)
                }
                disabled={sending || selected === "switchboard"}
                className="flex-1 bg-transparent px-2 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none resize-none disabled:opacity-50 min-w-0 max-h-32"
              />

              {/* Send (up arrow) — small, inside the textarea bar on the right */}
              <button
                onClick={handleSend}
                disabled={sending || selected === "switchboard" || (!text.trim() && attachments.length === 0)}
                title="Send"
                className="flex-shrink-0 h-9 w-9 flex items-center justify-center text-indigo-400 hover:text-indigo-200 disabled:text-slate-700 disabled:hover:text-slate-700"
              >
                {sending ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                    <circle cx="12" cy="12" r="10" strokeDasharray="48" strokeDashoffset="32" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <polyline points="6 10 12 4 18 10" />
                  </svg>
                )}
              </button>
            </div>

            {/* Voice + Call + Thinking — single compact row */}
            <div className="mt-1.5 flex items-center gap-1.5">
            {selected !== "switchboard" ? (
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={transcribing || sending}
              className={`flex-1 h-7 rounded-md flex items-center justify-center gap-1 text-[11px] font-medium border transition-colors ${
                recording
                  ? "bg-red-600/25 border-red-500/60 text-red-200 animate-pulse"
                  : transcribing
                  ? "bg-amber-600/15 border-amber-500/40 text-amber-300"
                  : "bg-emerald-600/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/25"
              }`}
            >
              {transcribing ? (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                    <circle cx="12" cy="12" r="10" strokeDasharray="48" strokeDashoffset="32" strokeLinecap="round" />
                  </svg>
                  Sending…
                </>
              ) : recording ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-sm bg-red-300" />
                  Stop &amp; send
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 11a7 7 0 0014 0" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <line x1="8" y1="22" x2="16" y2="22" />
                  </svg>
                  Voice
                </>
              )}
            </button>
            ) : null}

            {/* Pipeline phone-call button — works for any agent (incl. Switchboard), free */}
            <button
              type="button"
              onClick={inCall ? endCall : startCall}
              disabled={transcribing || sending}
              className={`flex-1 h-7 rounded-md flex items-center justify-center gap-1 text-[11px] font-semibold border transition-colors ${
                inCall
                  ? "bg-red-600/30 border-red-500/70 text-red-200 animate-pulse"
                  : "bg-indigo-600/15 border-indigo-500/40 text-indigo-200 hover:bg-indigo-600/25"
              }`}
            >
              {inCall ? (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 15.46l-5.27-.61-2.52 2.52a11 11 0 01-5.58-5.58l2.53-2.52L9.55 4H4a1 1 0 00-1 1 16 16 0 0016 16 1 1 0 001-1l-.05-4.54-.95.99zM19 12h2a9 9 0 00-9-9v2a7 7 0 017 7zm-4 0h2a5 5 0 00-5-5v2a3 3 0 013 3z" transform="rotate(135 12 12)" />
                  </svg>
                  End · {callStatus === "listening" ? "listening" : callStatus === "speaking-detected" ? "hearing you" : callStatus === "transcribing" ? "transcribing" : callStatus === "thinking" ? "thinking" : callStatus === "speaking" ? "speaking" : "connecting"}
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                  </svg>
                  Phone {AGENT_META[selected].name}
                </>
              )}
            </button>

            </div>

            {callLiveTranscript && inCall ? (
              <div className="mt-2 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-100">
                <span className="text-indigo-300">Live transcript:</span> {callLiveTranscript}
              </div>
            ) : null}

            {polling ? null : (
              <div className="mt-1 text-[10px] text-slate-600 text-center">poll paused</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserAgentChat({ agentName, userSeed, agentSeedOverrides, initialRows = [] }: { agentName: string; userSeed: string; agentSeedOverrides: Record<string,string>; initialRows?: MessageRow[] }) {
  const resolveAgentSeed = (slug: string) => agentSeedOverrides[slug.toLowerCase()] || agentAvatarSeed(slug);
  const [rows, setRows] = useState<MessageRow[]>(initialRows);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  useAutogrowTextarea(composerRef, text);
  const [replyTo, setReplyTo] = useState<{ author: string; snippet: string } | null>(null);
  const onReply = useCallback((snippet: string, author: string) => {
    setReplyTo({ author, snippet });
    setTimeout(() => composerRef.current?.focus(), 0);
  }, []);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any | null>(null);
  const speechBufferRef = useRef("");
  const isFirstScrollRef = useRef(true);
  const lastSeenLenRef = useRef(0);

  type Toast = { id: number; kind: "memory" | "wiki" | "skill" | "delegate"; text: string };
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seenActivityRef = useRef<Set<string>>(new Set());
  const toastIdRef = useRef(0);

  // Ticking clock for the running pill's freshness colour (see admin view above).
  const hasRunning = rows.some((r) => r.agent_state === "running");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!hasRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasRunning]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/agents/messages?limit=50", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      if (Array.isArray(d?.rows)) setRows(d.rows);
    } catch { /* ignore */ }
  }, []);

  const [toolDisclosure, setToolDisclosure] = useState<Record<string, boolean>>({});
  const toggleToolDisclosure = useCallback((corrId: string) => {
    setToolDisclosure((prev) => ({ ...prev, [corrId]: !prev[corrId] }));
  }, []);

  const stopTurn = useCallback(async (corrId: string) => {
    try {
      await fetch("/api/agents/me/stop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ corr_id: corrId }),
      });
      await refresh();
    } catch { /* ignore */ }
  }, [refresh]);

  useEffect(() => {
    refresh();
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/agents/messages/stream");
      es.addEventListener("ping", () => { refresh(); });
      es.addEventListener("ready", () => { refresh(); });
    } catch { /* fall back to interval below */ }
    const id = setInterval(refresh, 30_000);
    return () => { es?.close(); clearInterval(id); };
  }, [refresh]);

  useEffect(() => {
    if (seenActivityRef.current.size === 0 && rows.length > 0) {
      for (const r of rows) {
        for (const f of r.memory_saved || []) seenActivityRef.current.add(`${r.corr_id}:m:${f}`);
        for (const f of r.wiki_saved || []) seenActivityRef.current.add(`${r.corr_id}:w:${f}`);
        for (const f of r.skills_saved || []) seenActivityRef.current.add(`${r.corr_id}:s:${f}`);
        for (const d of r.delegations || []) seenActivityRef.current.add(`${r.corr_id}:d:${d.corr_id}`);
      }
      return;
    }
    const newToasts: Toast[] = [];
    for (const r of rows) {
      for (const f of r.memory_saved || []) {
        const k = `${r.corr_id}:m:${f}`;
        if (!seenActivityRef.current.has(k)) { seenActivityRef.current.add(k); newToasts.push({ id: ++toastIdRef.current, kind: "memory", text: f }); }
      }
      for (const f of r.wiki_saved || []) {
        const k = `${r.corr_id}:w:${f}`;
        if (!seenActivityRef.current.has(k)) { seenActivityRef.current.add(k); newToasts.push({ id: ++toastIdRef.current, kind: "wiki", text: f }); }
      }
      for (const f of r.skills_saved || []) {
        const k = `${r.corr_id}:s:${f}`;
        if (!seenActivityRef.current.has(k)) { seenActivityRef.current.add(k); newToasts.push({ id: ++toastIdRef.current, kind: "skill", text: f }); }
      }
      for (const d of r.delegations || []) {
        const k = `${r.corr_id}:d:${d.corr_id}`;
        if (!seenActivityRef.current.has(k)) { seenActivityRef.current.add(k); newToasts.push({ id: ++toastIdRef.current, kind: "delegate", text: `→ ${d.to}: ${d.task}` }); }
      }
    }
    if (newToasts.length === 0) return;
    setToasts((prev) => [...prev, ...newToasts]);
    for (const t of newToasts) {
      setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== t.id)), 4000);
    }
  }, [rows]);

  // Auto-scroll on any content change — new rows AND existing rows growing
  // their text as the agent's reply fills in. Only fires when the user was
  // already near the bottom; if they scrolled up to read history, we leave
  // them where they are.
  const wasNearBottomRef = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      wasNearBottomRef.current = distFromBottom < 120;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  const contentFingerprint = useMemo(
    () => rows.map((r) => `${r.corr_id}:${r.agent_state || ""}:${(r.agent_text || "").length}:${(r.user_text || "").length}`).join("|"),
    [rows],
  );
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    if (isFirstScrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      if (rows.length > 0) isFirstScrollRef.current = false;
    } else if (wasNearBottomRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [contentFingerprint, rows.length]);

  const send = useCallback(async () => {
    const raw = text.trim();
    const quote = replyTo ? buildReplyQuote(replyTo.author, replyTo.snippet) : "";
    const t = quote ? (raw ? `${quote}\n\n${raw}` : quote) : raw;
    if ((!t && attachments.length === 0) || sending) return;
    setSending(true);
    setErr(null);
    try {
      const r = await fetch("/api/agents/me/enqueue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: t,
          confirmed: true,
          attachments: attachments.map((a) => ({ name: a.name, path: a.path, mime: a.mime, size: a.size })),
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setErr(d?.error || `HTTP ${r.status}`);
      } else {
        setText("");
        setAttachments([]);
        setReplyTo(null);
        refresh();
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setSending(false);
    }
  }, [text, attachments, sending, refresh, replyTo]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    const fd = new FormData();
    for (const f of arr) fd.append("files", f);
    setErr(null);
    try {
      const res = await fetch("/api/agents/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { files: Attachment[] };
      const withPreview = data.files.map((f, i) => ({
        ...f,
        localPreview: arr[i] && arr[i].type.startsWith("image/") ? URL.createObjectURL(arr[i]) : undefined,
      }));
      setAttachments((prev) => [...prev, ...withPreview]);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => {
      const a = prev[idx];
      if (a?.localPreview) URL.revokeObjectURL(a.localPreview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const onPaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const it of Array.from(items)) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) { e.preventDefault(); handleFiles(files); }
  }, [handleFiles]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const startRecording = useCallback(async () => {
    if (recording) return;
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      speechBufferRef.current = "";
      setLiveTranscript("");

      const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionCtor) {
        try {
          const rec = new SpeechRecognitionCtor();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = "en-AU";
          rec.onresult = (event: any) => {
            let finalText = "";
            let interimText = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const transcript = event.results[i][0]?.transcript || "";
              if (event.results[i].isFinal) finalText += transcript;
              else interimText += transcript;
            }
            if (finalText.trim()) speechBufferRef.current = `${speechBufferRef.current} ${finalText}`.trim();
            setLiveTranscript(`${speechBufferRef.current} ${interimText}`.trim());
          };
          rec.start();
          recognitionRef.current = rec;
        } catch { /* fall back to local STT */ }
      }

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        setTranscribing(true);
        try {
          const rec = recognitionRef.current;
          if (rec) {
            await new Promise<void>((resolve) => {
              let done = false;
              const finish = () => { if (!done) { done = true; resolve(); } };
              try { rec.onend = finish; } catch { /* ignore */ }
              try { rec.stop(); } catch { finish(); }
              setTimeout(finish, 800);
            });
            recognitionRef.current = null;
          }
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
          // Async STT: upload audio, send envelope immediately. Runner transcribes
          // server-side before calling the model. Same total latency, instant send.
          let audioAttachment: { name: string; path: string; mime: string; size: number } | null = null;
          if (blob.size > 0) {
            try {
              const upFd = new FormData();
              upFd.append("files", blob, "voice.webm");
              const upRes = await fetch("/api/agents/upload", { method: "POST", body: upFd });
              if (upRes.ok) {
                const upData = (await upRes.json()) as { files: { name: string; path: string; mime: string; size: number }[] };
                audioAttachment = upData.files?.[0] || null;
              }
            } catch { /* fall through — runner handles missing audio */ }
          }
          const liveSnap = speechBufferRef.current.trim();
          const draft = text.trim();
          const combined = [draft, liveSnap ? `[voice transcript hint: ${liveSnap}]` : ""].filter(Boolean).join("\n\n");
          if (!combined && !audioAttachment && attachments.length === 0) return;
          const r = await fetch("/api/agents/me/enqueue", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              text: combined || (audioAttachment ? "[voice message]" : ""),
              confirmed: true,
              attachments: [
                ...(audioAttachment ? [audioAttachment] : []),
                ...attachments.map((a) => ({ name: a.name, path: a.path, mime: a.mime, size: a.size })),
              ],
            }),
          });
          if (!r.ok) {
            const d = await r.json().catch(() => ({}));
            setErr(d?.error || `HTTP ${r.status}`);
          } else {
            setText("");
            setAttachments([]);
            setLiveTranscript("");
            speechBufferRef.current = "";
            refresh();
          }
        } catch (e) {
          setErr((e as Error).message);
        } finally {
          setTranscribing(false);
        }
      };
      recorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [recording, text, attachments, refresh]);

  const stopRecording = useCallback(() => {
    if (!recorderRef.current) return;
    if (recorderRef.current.state !== "inactive") recorderRef.current.stop();
    setRecording(false);
  }, []);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="fixed inset-x-0 top-0 bottom-[56px] md:bottom-0 md:left-52 bg-[#0a0a0a] flex flex-col overflow-hidden">
      <div className="pointer-events-none fixed inset-x-0 top-1/4 z-50 flex flex-col items-center gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`mc-activity-toast flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold shadow-2xl backdrop-blur border-2 ${
              t.kind === "memory" ? "bg-violet-600/40 border-violet-400/70 text-violet-50 shadow-violet-900/40"
              : t.kind === "wiki" ? "bg-sky-600/40 border-sky-400/70 text-sky-50 shadow-sky-900/40"
              : t.kind === "skill" ? "bg-amber-600/40 border-amber-400/70 text-amber-50 shadow-amber-900/40"
              : "bg-rose-600/40 border-rose-400/70 text-rose-50 shadow-rose-900/40"
            }`}
          >
            {t.kind === "memory" ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
              </svg>
            ) : t.kind === "wiki" ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
            ) : t.kind === "skill" ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2 11 13"/>
                <path d="M22 2 15 22 11 13 2 9 22 2z"/>
              </svg>
            )}
            <span className="flex flex-col leading-tight">
              <span className="text-[10px] uppercase tracking-widest opacity-80">{agentName} → {t.kind}</span>
              <span className="font-mono text-[12px] opacity-95">{t.kind === "delegate" ? t.text : t.text.split("/").pop()?.replace(/\.md$/, "")}</span>
            </span>
          </div>
        ))}
      </div>
      <style jsx global>{`
        @keyframes mcFadeUp {
          0%   { opacity: 0; transform: translateY(20px) scale(0.95); }
          12%  { opacity: 1; transform: translateY(0) scale(1.04); }
          18%  { transform: translateY(0) scale(1); }
          75%  { opacity: 1; transform: translateY(-30px) scale(1); }
          100% { opacity: 0; transform: translateY(-90px) scale(0.95); }
        }
        .mc-activity-toast {
          animation: mcFadeUp 4s ease-out forwards;
          will-change: transform, opacity;
        }
      `}</style>
      <div className="max-w-[84rem] w-full mx-auto px-3 sm:px-6 pt-2 sm:pt-3 pb-2 flex-1 min-h-0 flex flex-col">
        {/* Header pill */}
        <div className="mb-2 flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border border-violet-700/30 bg-violet-900/15">
          <span className="w-2 h-2 rounded-full bg-violet-400" />
          <div className="text-sm font-semibold text-violet-200">{agentName}</div>
          <div className="text-[10px] text-slate-500 tracking-wider uppercase">Your agent</div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-slate-800/60 bg-slate-950/70 backdrop-blur overflow-hidden">
          <div ref={scrollRef} className="scroll-pretty flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4 min-h-0">
            {rows.length === 0 ? (
              <div className="text-sm text-slate-500 italic">No messages with {agentName} yet — start typing below.</div>
            ) : rows.map((r) => (
              <div key={r.corr_id} className="space-y-2">
                {r.user_text || (r.user_attachments && r.user_attachments.length > 0) ? (() => {
                  const visibleText = stripAttachmentTail(r.user_text);
                  return (
                    <div className="flex justify-end items-start gap-2">
                      <div className="group relative max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600/20 border border-indigo-700/30 px-3 py-2 text-sm text-slate-100">
                        {visibleText ? <MessageActions text={visibleText} author="You" onReply={onReply} /> : null}
                        {visibleText ? <div className="whitespace-pre-wrap break-words">{visibleText}</div> : null}
                        {r.user_attachments && r.user_attachments.length > 0 ? <AttachmentList files={r.user_attachments} /> : null}
                        {r.user_ts ? <div className="text-[10px] text-slate-500 mt-1 tabular-nums">{new Date(r.user_ts).toLocaleTimeString()}</div> : null}
                      </div>
                      <PixelAvatar seed={userSeed} size={28} title="You" />
                    </div>
                  );
                })() : null}
                <div className="flex justify-start items-start gap-2">
                  <PixelAvatar seed={resolveAgentSeed(r.agent || "me")} size={28} title={agentName} activity={r.agent_state === "running" ? (r.activity_kind || "thinking") : null} />
                  <div className="group relative max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-800/40 border border-slate-700/30 px-3 py-2 text-sm leading-relaxed text-slate-200">
                    {r.agent_text ? <MessageActions text={r.agent_text} author={agentName} onReply={onReply} /> : null}
                    <div className="flex items-center gap-2 mb-1">
                      <StateBadge
                        state={r.agent_state}
                        lastEventTs={r.last_event_ts}
                        activityKind={r.activity_kind}
                        currentTool={r.current_tool}
                        now={now}
                      />
                      {(r.agent_state === "queued" || r.agent_state === "running") ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); stopTurn(r.corr_id); }}
                          title="Stop this turn"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium leading-none border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-colors"
                        >
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="6" y="6" width="12" height="12" rx="1.5" />
                          </svg>
                          Stop
                        </button>
                      ) : null}
                      {(r.agent_state === "running" && !r.agent_text) ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleToolDisclosure(r.corr_id); }}
                          title={toolDisclosure[r.corr_id] ? "Hide tool detail" : "Show tool detail"}
                          className="text-[14px] leading-none text-slate-400 hover:text-slate-200 transition-colors px-1"
                        >
                          {toolDisclosure[r.corr_id] ? "−" : "+"}
                        </button>
                      ) : null}
                      {(() => {
                        const startTs = r.agent_ts || r.user_ts;
                        if (r.agent_state === "running" && startTs) {
                          const ageS = Math.max(0, Math.floor((now - new Date(startTs).getTime()) / 1000));
                          const label = ageS < 60 ? `${ageS}s` : `${Math.floor(ageS / 60)}m${ageS % 60 ? ` ${ageS % 60}s` : ""}`;
                          return <span className="text-[10px] text-slate-500 ml-auto tabular-nums">{label}</span>;
                        }
                        if (r.elapsed_ms) {
                          return <span className="text-[10px] text-slate-500 ml-auto tabular-nums">{Math.round(r.elapsed_ms / 1000)}s</span>;
                        }
                        return null;
                      })()}
                    </div>
                    {r.agent_text ? (
                      <RichAgentText text={r.agent_text} />
                    ) : (() => {
                      // Running rows only show their inner detail when the user has
                      // expanded the +/- disclosure. Default (collapsed) = just the
                      // pill above. Other terminal states still render their line.
                      if (r.agent_state === "running" && !toolDisclosure[r.corr_id]) return null;
                      return (
                        <div className="text-slate-500 italic text-xs">
                          {r.agent_state === "queued" ? "Waiting in agent inbox…"
                            : r.agent_state === "running" ? (
                                r.current_tool_summary
                                  ? `${r.current_tool_summary}${r.current_tool_summary_ts && !r.current_tool ? ` · ${Math.max(0, Math.floor((now - new Date(r.current_tool_summary_ts).getTime()) / 1000))}s ago` : ""}`
                                  : r.activity_kind === "doing"
                                    ? `${agentName} is working…`
                                    : HUMOR_LINES[Math.floor((r.elapsed_ms || now) / 5000) % HUMOR_LINES.length]
                              )
                            : r.agent_state === "error" ? `Error: ${r.error || "unknown"}`
                          : "—"}
                        </div>
                      );
                    })()}
                    {(r.memory_saved && r.memory_saved.length > 0) || (r.wiki_saved && r.wiki_saved.length > 0) || (r.skills_saved && r.skills_saved.length > 0) || (r.delegations && r.delegations.length > 0) ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(r.delegations || []).map((d) => (
                          <DelegationChip key={`d-${d.corr_id}`} d={d} />
                        ))}
                        {(r.memory_saved || []).map((name) => (
                          <span key={`m-${name}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-violet-200 bg-violet-500/15 border border-violet-500/30" title={`Saved to memory: ${name}`}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
                              <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
                            </svg>
                            {name.replace(/\.md$/, "")}
                          </span>
                        ))}
                        {(r.wiki_saved || []).map((name) => (
                          <span key={`w-${name}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-sky-200 bg-sky-500/15 border border-sky-500/30" title={`Saved to wiki: ${name}`}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                              <polyline points="17 21 17 13 7 13 7 21"/>
                              <polyline points="7 3 7 8 15 8"/>
                            </svg>
                            {name.split("/").pop()?.replace(/\.md$/, "")}
                          </span>
                        ))}
                        {(r.skills_saved || []).map((name) => (
                          <span key={`s-${name}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-amber-200 bg-amber-500/15 border border-amber-500/30" title={`Updated skill: ${name}`}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                            {name.split("/")[0]}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {r.agent_ts && r.agent_state === "done" ? <div className="text-[10px] text-slate-500 mt-1 tabular-nums">{new Date(r.agent_ts).toLocaleTimeString()}</div> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div
            className="border-t border-slate-800/60 p-2.5 sm:p-3 flex-shrink-0 bg-slate-950"
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {err ? <div className="text-xs text-red-400 mb-2">{err}</div> : null}

            {recording && liveTranscript ? (
              <div className="mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                <span className="text-emerald-300 font-semibold mr-1">Hearing:</span>
                {liveTranscript}
              </div>
            ) : recording ? (
              <div className="mb-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300/70 italic">
                Listening… speak naturally; tap the green button to stop.
              </div>
            ) : null}

            {attachments.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg bg-slate-800/60 border border-slate-700/40 text-xs text-slate-200">
                    {a.localPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.localPreview} alt={a.name} className="w-6 h-6 rounded object-cover" />
                    ) : (
                      <span className="w-6 h-6 rounded bg-slate-700 flex items-center justify-center text-[10px] text-slate-400">F</span>
                    )}
                    <span className="truncate max-w-[120px]">{a.name}</span>
                    <button onClick={() => removeAttachment(i)} className="px-1 text-slate-500 hover:text-slate-200">✕</button>
                  </div>
                ))}
              </div>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,text/plain,.json,.csv,.md,.log"
              className="hidden"
              onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
            />

            {replyTo ? (
              <ReplyPreview author={replyTo.author} snippet={replyTo.snippet} onCancel={() => setReplyTo(null)} />
            ) : null}

            <div className="relative flex items-end bg-slate-900 border border-slate-700/60 rounded-xl focus-within:border-violet-500/60 transition-colors">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
                className="flex-shrink-0 h-9 w-9 flex items-center justify-center text-slate-400 hover:text-slate-100"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
              </button>

              <textarea
                ref={composerRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKey}
                onPaste={onPaste}
                rows={1}
                placeholder={transcribing ? "Transcribing…" : `Message ${agentName}…`}
                disabled={sending}
                className="flex-1 bg-transparent px-2 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none resize-none disabled:opacity-50 min-w-0 max-h-32"
              />

              <button
                onClick={send}
                disabled={sending || (!text.trim() && attachments.length === 0)}
                title="Send"
                className="flex-shrink-0 h-9 w-9 flex items-center justify-center text-violet-400 hover:text-violet-200 disabled:text-slate-700 disabled:hover:text-slate-700"
              >
                {sending ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                    <circle cx="12" cy="12" r="10" strokeDasharray="48" strokeDashoffset="32" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <polyline points="6 10 12 4 18 10" />
                  </svg>
                )}
              </button>
            </div>

            <div className="mt-1.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribing || sending}
                className={`flex-1 h-7 rounded-md flex items-center justify-center gap-1 text-[11px] font-medium border transition-colors ${
                  recording
                    ? "bg-red-600/25 border-red-500/60 text-red-200 animate-pulse"
                    : transcribing
                    ? "bg-amber-600/15 border-amber-500/40 text-amber-300"
                    : "bg-emerald-600/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/25"
                }`}
              >
                {transcribing ? (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                      <circle cx="12" cy="12" r="10" strokeDasharray="48" strokeDashoffset="32" strokeLinecap="round" />
                    </svg>
                    Sending…
                  </>
                ) : recording ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-sm bg-red-300" />
                    Stop &amp; send
                  </>
                ) : (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="2" width="6" height="12" rx="3" />
                      <path d="M5 11a7 7 0 0014 0" />
                      <line x1="12" y1="18" x2="12" y2="22" />
                      <line x1="8" y1="22" x2="16" y2="22" />
                    </svg>
                    Voice
                  </>
                )}
              </button>

              {/* Phone — placeholder, disabled until per-user voice is wired */}
              <button
                type="button"
                disabled
                title="Phone calls coming soon"
                className="flex-1 h-7 rounded-md flex items-center justify-center gap-1 text-[11px] font-semibold border bg-slate-800/30 border-slate-700/40 text-slate-600 cursor-not-allowed"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                </svg>
                Phone {agentName}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
