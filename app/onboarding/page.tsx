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
  const [suggestedApps, setSuggestedApps] = useState<{ name: string; description: string; why: string }[]>([]);
  const [showAppPicker, setShowAppPicker] = useState(false);
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

  async function skip() {
    if (loading) return;
    const next: Message[] = [...messages, { role: "user", text: "Skip this one — move on to the next topic." }];
    setMessages(next);
    setInput("");
    await askNext(next);
  }

  async function finishEarly() {
    if (loading || !confirm("Wrap up the interview now? I'll save what I have and you can fine-tune anything later in Settings.")) return;
    const next: Message[] = [...messages, { role: "user", text: "I'd like to wrap up the interview now. Please return the compiled plan for whatever you have so far; use sensible empty fallbacks for pillars we didn't cover." }];
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
      const d = await r.json().catch(() => ({}));
      const apps = Array.isArray(d?.suggestedApps) ? d.suggestedApps : [];
      if (apps.length > 0) {
        setSuggestedApps(apps);
        setShowAppPicker(true);
      } else {
        setTimeout(() => router.replace("/"), 1500);
      }
    } finally {
      setLoading(false);
    }
  }

  function buildApp(idea: { name: string; description: string }) {
    const qs = new URLSearchParams({ description: idea.description }).toString();
    router.replace(`/elements/new?${qs}`);
  }

  function skipAppPicker() {
    router.replace("/");
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
            {done && !showAppPicker && (
              <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-200">
                All set. Setting up your workspace…
              </div>
            )}
            {showAppPicker && (
              <div className="space-y-3">
                <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-200">
                  Workspace set up. Here are a few starter apps tailored to what you shared — pick one to build now, or skip and explore the dashboard.
                </div>
                {suggestedApps.map((app, i) => (
                  <button
                    key={i}
                    onClick={() => buildApp(app)}
                    className="w-full text-left rounded-xl border border-white/10 bg-slate-800/40 hover:border-indigo-500/50 hover:bg-slate-800/70 transition-colors px-4 py-3"
                  >
                    <div className="text-sm font-semibold text-slate-100">{app.name}</div>
                    <div className="text-xs text-slate-300 mt-1 line-clamp-3">{app.description}</div>
                    {app.why && <div className="text-[11px] text-slate-500 italic mt-1.5">Why: {app.why}</div>}
                  </button>
                ))}
                <button
                  onClick={skipAppPicker}
                  className="w-full text-center text-xs text-slate-400 hover:text-slate-200 py-2"
                >Skip — go to dashboard →</button>
              </div>
            )}
          </div>

          {/* Composer */}
          {!done && !showAppPicker && (
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
              <div className="flex items-center justify-between mt-2">
                <button
                  onClick={skip}
                  disabled={loading || messages.length === 0}
                  className="text-[11px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
                  title="Skip this question and move to the next topic"
                >Skip this →</button>
                <button
                  onClick={finishEarly}
                  disabled={loading || messages.length === 0 || pillarsComplete.length < 2}
                  className="text-[11px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
                  title="Wrap up the interview with whatever you've shared so far"
                >Wrap up now ✓</button>
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
