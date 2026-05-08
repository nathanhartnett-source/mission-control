"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Tone = "concise" | "warm" | "dry-wit" | "professional" | "playful";
type Formality = "casual" | "balanced" | "formal";

const TONE_OPTIONS: { value: Tone; label: string; blurb: string }[] = [
  { value: "concise",      label: "Concise",      blurb: "Short, to the point. No fluff." },
  { value: "warm",         label: "Warm",         blurb: "Friendly, supportive, conversational." },
  { value: "dry-wit",      label: "Dry wit",      blurb: "Subtle humour. Doesn't take itself too seriously." },
  { value: "professional", label: "Professional", blurb: "Polished, formal-ish, business tone." },
  { value: "playful",      label: "Playful",      blurb: "Lively, energetic, more casual." },
];

const FORM_OPTIONS: { value: Formality; label: string }[] = [
  { value: "casual",   label: "Casual" },
  { value: "balanced", label: "Balanced" },
  { value: "formal",   label: "Formal" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [agentName, setAgentName] = useState("");
  const [tone, setTone] = useState<Tone>("concise");
  const [emoji, setEmoji] = useState(false);
  const [formality, setFormality] = useState<Formality>("balanced");
  const [aboutMe, setAboutMe] = useState("");
  const [goals, setGoals] = useState("");
  const [followUpQs, setFollowUpQs] = useState<string[]>([]);
  const [followUpAs, setFollowUpAs] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/auth/me").then(async r => {
      if (!r.ok) { router.replace("/login"); return; }
      const data = await r.json();
      if (data?.user?.personaCompleted) router.replace("/");
    });
  }, [router]);

  async function nextFromGoals() {
    setError(null);
    if (!agentName.trim()) { setError("Pick a name for your agent."); return; }
    if (!aboutMe.trim() || !goals.trim()) { setError("Please fill in both about-you and goals."); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/onboarding/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName, tone, aboutMe, goals }),
      });
      const data = await r.json();
      const qs: string[] = Array.isArray(data?.questions) ? data.questions : [];
      setFollowUpQs(qs);
      setFollowUpAs(qs.map(() => ""));
      setStep(qs.length > 0 ? 4 : 5);
    } catch {
      setStep(5);
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const r = await fetch("/api/onboarding/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentName, tone, emoji, formality, aboutMe, goals,
          followUps: followUpQs.map((q, i) => ({ question: q, answer: followUpAs[i] || "" })),
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data?.error || "Failed to save. Try again.");
        return;
      }
      router.replace("/");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white">Set up your agent</h1>
          <p className="text-sm text-slate-400 mt-1">A few quick questions so it feels like yours.</p>
          <p className="text-xs text-slate-500 mt-2">Step {step} of {followUpQs.length > 0 ? 5 : 4}</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
          {step === 1 && (
            <>
              <label className="block text-sm text-slate-300 mb-2">What do you want to call your agent?</label>
              <input
                value={agentName}
                onChange={e => setAgentName(e.target.value)}
                maxLength={30}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm"
                placeholder="e.g. Hazel"
                autoFocus
              />
              <p className="text-xs text-slate-500">It will introduce itself with this name.</p>
              <div className="flex justify-end pt-2">
                <button onClick={() => agentName.trim() ? setStep(2) : setError("Pick a name first.")}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm">
                  Next
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <label className="block text-sm text-slate-300 mb-2">How should {agentName || "your agent"} sound?</label>
              <div className="space-y-2">
                {TONE_OPTIONS.map(opt => (
                  <button key={opt.value}
                    onClick={() => setTone(opt.value)}
                    className={`w-full text-left p-3 rounded-lg border text-sm transition ${tone === opt.value
                      ? "border-indigo-500 bg-indigo-500/10 text-white"
                      : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600"}`}>
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs text-slate-400">{opt.blurb}</div>
                  </button>
                ))}
              </div>

              <div className="pt-3">
                <label className="block text-sm text-slate-300 mb-2">Formality</label>
                <div className="flex gap-2">
                  {FORM_OPTIONS.map(opt => (
                    <button key={opt.value}
                      onClick={() => setFormality(opt.value)}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm ${formality === opt.value
                        ? "border-indigo-500 bg-indigo-500/10 text-white"
                        : "border-slate-700 bg-slate-800 text-slate-300"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex items-center gap-2">
                <input type="checkbox" id="emoji" checked={emoji} onChange={e => setEmoji(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800" />
                <label htmlFor="emoji" className="text-sm text-slate-300">Use emojis 🎉</label>
              </div>

              <div className="flex justify-between pt-3">
                <button onClick={() => setStep(1)} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm">Back</button>
                <button onClick={() => setStep(3)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm">Next</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <label className="block text-sm text-slate-300 mb-2">Tell {agentName} about yourself</label>
              <textarea
                value={aboutMe}
                onChange={e => setAboutMe(e.target.value)}
                rows={4}
                maxLength={4000}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm"
                placeholder="Who you are, what you do, likes/dislikes, anything that helps your agent know you."
              />

              <label className="block text-sm text-slate-300 mb-2 mt-4">What do you want from your agent?</label>
              <textarea
                value={goals}
                onChange={e => setGoals(e.target.value)}
                rows={4}
                maxLength={4000}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm"
                placeholder="What you'd like it to help with, what would make it useful to you."
              />

              {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

              <div className="flex justify-between pt-3">
                <button onClick={() => setStep(2)} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm">Back</button>
                <button onClick={nextFromGoals} disabled={loading}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50">
                  {loading ? "Thinking…" : "Next"}
                </button>
              </div>
            </>
          )}

          {step === 4 && followUpQs.length > 0 && (
            <>
              <p className="text-sm text-slate-300 mb-3">A couple more questions to help {agentName} tailor itself:</p>
              {followUpQs.map((q, i) => (
                <div key={i} className="mb-3">
                  <label className="block text-sm text-slate-200 mb-1">{q}</label>
                  <textarea
                    value={followUpAs[i] || ""}
                    onChange={e => {
                      const next = [...followUpAs];
                      next[i] = e.target.value;
                      setFollowUpAs(next);
                    }}
                    rows={2}
                    maxLength={2000}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm"
                  />
                </div>
              ))}
              <div className="flex justify-between pt-2">
                <button onClick={() => setStep(3)} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm">Back</button>
                <button onClick={() => setStep(5)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm">Next</button>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <p className="text-sm text-slate-300 mb-3">All set. Ready to meet {agentName}?</p>
              <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 text-xs text-slate-400 space-y-1">
                <div><span className="text-slate-500">Name:</span> <span className="text-slate-200">{agentName}</span></div>
                <div><span className="text-slate-500">Tone:</span> <span className="text-slate-200">{tone} · {formality}{emoji ? " · emoji" : ""}</span></div>
              </div>
              {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
              <div className="flex justify-between pt-4">
                <button onClick={() => setStep(followUpQs.length > 0 ? 4 : 3)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm">Back</button>
                <button onClick={submit} disabled={loading}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-50">
                  {loading ? "Saving…" : "Finish"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
