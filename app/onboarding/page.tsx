"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PixelAvatar from "@/app/components/PixelAvatar";
import { useSiteName } from "@/app/components/SiteProvider";
import { rollAvatarSeed, agentAvatarSeed } from "@/lib/avatar";

type Pillar = "identity" | "friction" | "tools" | "dashboard" | "comms" | "focus" | "principles";

const PILLAR_LABELS: Record<Pillar, string> = {
  identity: "Who you are",
  friction: "Where work gets messy",
  tools: "Where your info lives",
  dashboard: "What you want on screen",
  comms: "How I should sound",
  focus: "Where to help first",
  principles: "What to watch out for",
};
const PILLARS: Pillar[] = ["identity", "friction", "tools", "dashboard", "comms", "focus", "principles"];

type Message = { role: "user" | "assistant"; text: string };

export default function OnboardingPage() {
  const router = useRouter();
  const siteName = useSiteName();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPillar, setCurrentPillar] = useState<Pillar>("identity");
  const [pillarsComplete, setPillarsComplete] = useState<Pillar[]>([]);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [agentSeed, setAgentSeed] = useState<string>(() => agentAvatarSeed("me"));
  const [done, setDone] = useState<null | { compiled: unknown }>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(async (r) => {
      if (!r.ok) { router.replace("/login"); return; }
      const data = await r.json();
      if (data?.user?.personaCompleted) router.replace("/");
      else if (messages.length === 0) askNext([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function askNext(currentMessages: Message[]) {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/onboarding/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: currentMessages }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data?.error || "Interview hiccup. Try again.");
        return;
      }
      if (data.type === "done") {
        setDone({ compiled: data.plan });
        await save(data.plan);
        return;
      }
      if (data.type === "question") {
        setCurrentPillar((data.currentPillar as Pillar) || "identity");
        setPillarsComplete(Array.isArray(data.pillarsComplete) ? data.pillarsComplete : []);
        setMessages([...currentMessages, { role: "assistant", text: String(data.text || "") }]);
        setQuestionNumber((n) => n + 1);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Message[] = [...messages, { role: "user", text }];
    setMessages(next);
    setInput("");
    await askNext(next);
  }

  async function save(plan: unknown) {
    setLoading(true);
    try {
      const r = await fetch("/api/onboarding/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d?.error || "Save failed.");
        return;
      }
      // Brief breath, then redirect.
      setTimeout(() => router.replace("/"), 1500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Blurred dashboard-ish background */}
      <div className="fixed inset-0 -z-10 bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_20%_20%,rgba(99,102,241,0.18),transparent_60%),radial-gradient(50%_50%_at_80%_70%,rgba(236,72,153,0.12),transparent_60%)]" />
        <div className="absolute inset-0 backdrop-blur-3xl" />
      </div>

      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-4">
          {questionNumber === 0 ? (
            <>
              <h1 className="text-3xl font-semibold text-white tracking-tight">Welcome in</h1>
              <p className="text-sm text-slate-400 mt-1">{siteName} — let&rsquo;s get to know you. First question coming up.</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-white tracking-tight">
                {questionNumber === 1 ? "First question" : `Question ${questionNumber}`}
              </h1>
              <p className="text-[11px] uppercase tracking-widest text-slate-500 mt-1">
                {PILLAR_LABELS[currentPillar]}
              </p>
            </>
          )}
        </div>

        {/* Pillar progress dots */}
        <div className="flex justify-center gap-1.5 mb-4">
          {PILLARS.map((p) => {
            const isDone = pillarsComplete.includes(p);
            const isCurrent = currentPillar === p && !isDone;
            return (
              <div
                key={p}
                className={`h-1.5 w-8 rounded-full transition-all ${
                  isDone ? "bg-emerald-400" : isCurrent ? "bg-indigo-400" : "bg-slate-700"
                }`}
                title={PILLAR_LABELS[p]}
              />
            );
          })}
        </div>

        {/* Glass modal */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Avatar header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 bg-white/5">
            <PixelAvatar seed={agentSeed} size={40} />
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-100">Your agent</div>
              <div className="text-[11px] text-slate-400">Concierge setup</div>
            </div>
            <button
              type="button"
              onClick={() => setAgentSeed(rollAvatarSeed())}
              className="text-[11px] px-2 py-1 rounded-md bg-white/10 hover:bg-white/15 text-slate-300"
              title="Re-roll avatar"
            >🎲</button>
          </div>

          {/* Transcript */}
          <div ref={scrollRef} className="px-5 py-4 max-h-[50vh] overflow-y-auto space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800/80 text-slate-100"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && messages.length === 0 && (
              <div className="text-sm text-slate-400 text-center py-4">Connecting…</div>
            )}
            {loading && messages.length > 0 && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-2.5 bg-slate-800/80 text-slate-400 text-sm italic">
                  thinking…
                </div>
              </div>
            )}
            {done && (
              <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-200">
                All set. Setting up your workspace…
              </div>
            )}
          </div>

          {/* Composer */}
          {!done && (
            <div className="border-t border-white/5 bg-slate-950/40 px-3 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                  rows={2}
                  placeholder={questionNumber === 0 ? "Loading…" : "Type your answer (Enter to send)"}
                  disabled={loading || messages.length === 0}
                  className="flex-1 resize-none rounded-lg bg-slate-900/60 border border-white/10 text-slate-100 text-sm px-3 py-2 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
                />
                <button
                  onClick={send}
                  disabled={loading || !input.trim()}
                  className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-40"
                >Send</button>
              </div>
              {error && <p className="text-xs text-rose-300 mt-2">{error}</p>}
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-3">
          Skip any answer with &ldquo;not sure&rdquo; — you can edit everything later in Settings.
        </p>
      </div>
    </div>
  );
}
