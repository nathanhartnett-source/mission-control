"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// MediaRecorder is browser-only, type-cast safely
type MR = MediaRecorder;

type ScheduleSpec =
  | { type: "once"; date: string; time: string }
  | { type: "daily"; time: string }
  | { type: "weekly"; daysOfWeek: number[]; time: string }
  | { type: "monthly"; dayOfMonth: number; time: string }
  | { type: "monthly_nth_dow"; week: 1|2|3|4|-1; dayOfWeek: number; time: string };

type Alert = {
  id: string;
  kind?: "data" | "research" | "reminder";
  cronTime?: string;
  reminderText?: string;
  daysOfWeek?: number[];
  schedule?: ScheduleSpec;
  source?: string;
  dims?: Record<string, string>;
  op?: string;
  threshold?: number;
  prompt?: string;
  intent?: string;
  summary?: string;
  frequencyHours?: number;
  lastEvaluatedAt?: string;
  lastFindingSummary?: string;
  label?: string;
  active: boolean;
  cooldownHours: number;
  minConsecutiveSamples?: number;
  lastFiredAt?: string;
};

type Msg = { role: "user" | "assistant"; content: string };

function describeReminder(a: Alert): string {
  const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const WEEK_LABELS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", [-1]: "last" };
  const s = a.schedule;
  if (s) {
    switch (s.type) {
      case "once": return `Once at ${s.time} AEST on ${s.date}`;
      case "daily": return `Every day at ${s.time} AEST`;
      case "weekly": return `${s.daysOfWeek.map((d) => DOW[d]).join(", ")} at ${s.time} AEST`;
      case "monthly": return `Day ${s.dayOfMonth} of each month at ${s.time} AEST`;
      case "monthly_nth_dow": return `${WEEK_LABELS[s.week]} ${DOW[s.dayOfWeek]} of each month at ${s.time} AEST`;
    }
  }
  // legacy
  const time = a.cronTime || "?";
  if (a.daysOfWeek && a.daysOfWeek.length > 0 && a.daysOfWeek.length < 7) {
    return `${a.daysOfWeek.map((d) => DOW[d]).join(", ")} at ${time} AEST`;
  }
  return `Every day at ${time} AEST`;
}

export default function MyAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  // Chat state — used for both create and edit. editingId=null → creating new.
  const [chatOpen, setChatOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [pendingAlert, setPendingAlert] = useState<Partial<Alert> | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MR | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const refresh = () => {
    fetch("/api/data-alerts").then(r => r.json()).then(d => { setAlerts(d.alerts || []); setLoading(false); });
  };
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages, thinking]);

  const openNewChat = () => {
    setEditingId(null);
    setMessages([]);
    setInput("");
    setPendingAlert(null);
    setChatOpen(true);
  };

  const openEditChat = (a: Alert) => {
    setEditingId(a.id);
    setMessages([
      { role: "assistant", content: a.summary || `This alert is set up. Tell me how you'd like to change it.` },
    ]);
    setInput("");
    setPendingAlert(a);
    setChatOpen(true);
  };

  const closeChat = () => {
    setChatOpen(false);
    setEditingId(null);
    setMessages([]);
    setPendingAlert(null);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    const nextMessages: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setThinking(true);
    try {
      const payload: Record<string, unknown> = { messages: nextMessages };
      if (editingId && pendingAlert) payload.currentAlert = pendingAlert;
      const r = await fetch("/api/data-alerts/propose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      const reply: string = d.reply || "(no reply)";
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
      if (d.alert) setPendingAlert(d.alert);

      if (d.ready && d.alert) {
        // Auto-save
        if (editingId) {
          const rr = await fetch(`/api/data-alerts/${editingId}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(d.alert),
          });
          if (rr.ok) {
            toast.success("Alert updated");
            refresh();
            closeChat();
          } else {
            toast.error("Update failed");
          }
        } else {
          const rr = await fetch("/api/data-alerts", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(d.alert),
          });
          if (rr.ok) {
            toast.success("Alert created");
            refresh();
            closeChat();
          } else {
            const err = await rr.json().catch(() => ({}));
            toast.error(err.error || "Create failed");
          }
        }
      }
    } catch {
      setMessages([...nextMessages, { role: "assistant", content: "Network error — try again." }]);
    } finally {
      setThinking(false);
    }
  };

  const toggleActive = async (a: Alert) => {
    await fetch(`/api/data-alerts/${a.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !a.active }) });
    refresh();
  };

  const del = async (a: Alert) => {
    if (!confirm("Delete this alert?")) return;
    await fetch(`/api/data-alerts/${a.id}`, { method: "DELETE" });
    refresh();
  };

  const sendTest = async (a: Alert) => {
    toast.message("Generating sample…");
    const r = await fetch(`/api/data-alerts/${a.id}/test`, { method: "POST" });
    if (r.ok) toast.success("Sample sent to your Inbox");
    else toast.error("Sample failed");
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size === 0) return;
        setTranscribing(true);
        try {
          const fd = new FormData();
          fd.append("audio", blob, "voice.webm");
          const res = await fetch("/api/agents/transcribe", { method: "POST", body: fd });
          if (!res.ok) { toast.error("Transcription failed"); return; }
          const d = await res.json() as { text?: string };
          const text = (d.text || "").trim();
          if (text) setInput(prev => (prev ? prev + " " : "") + text);
        } catch {
          toast.error("Transcription error");
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      setRecording(true);
    } catch {
      toast.error("Mic access denied");
    }
  };

  const stopRec = () => {
    const mr = recorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    setRecording(false);
  };

  return (
    <main className="max-w-3xl mx-auto px-3 sm:px-6 py-6 sm:py-10 text-slate-200">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold">My Alerts</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Describe alerts in plain English. Chat with the AI to set them up or change them.</p>
        {!chatOpen && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button onClick={openNewChat} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium whitespace-nowrap">+ New alert</button>
          </div>
        )}
      </div>

      {chatOpen && (
        <div className="border border-slate-800 rounded-xl bg-slate-900/40 mb-8 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div className="text-sm font-medium text-slate-200">{editingId ? "Edit alert" : "New alert"}</div>
            <button onClick={closeChat} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
          </div>

          <div ref={chatScrollRef} className="max-h-80 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-sm text-slate-500">
                Describe what you want to be alerted about. Examples:
                <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
                  <li>Alert me if any page on any site drops below 80 PSI mobile, include likely causes.</li>
                  <li>Tell me when the ATO releases anything new for small-business compliance.</li>
                  <li>Ping me if any brand's 7-day revenue drops more than 20% week-on-week.</li>
                </ul>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`text-sm ${m.role === "user" ? "text-slate-100" : "text-slate-300"}`}>
                <div className={`inline-block max-w-[90%] px-3 py-2 rounded-lg ${m.role === "user" ? "bg-indigo-600/20 border border-indigo-700/40" : "bg-slate-800/60 border border-slate-700/40"}`}>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">{m.role === "user" ? "You" : "AI"}</div>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              </div>
            ))}
            {thinking && (
              <div className="text-sm text-slate-500 italic">AI is thinking…</div>
            )}
          </div>

          <div className="border-t border-slate-800 px-3 py-2 bg-slate-950/30">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                placeholder={editingId ? "Tell me what to change…" : "Describe the alert…"}
                rows={2}
                disabled={thinking}
                className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 resize-none"
              />
              <button
                onClick={recording ? stopRec : startRec}
                disabled={thinking || transcribing}
                title={recording ? "Stop recording" : "Voice message"}
                className={`px-3 rounded text-sm flex items-center justify-center ${recording ? "bg-rose-600 text-white hover:bg-rose-500 animate-pulse" : "bg-slate-800 text-slate-300 hover:bg-slate-700"} disabled:opacity-40`}
              >
                {transcribing ? "…" : recording ? "■" : "🎤"}
              </button>
              <button
                onClick={send}
                disabled={thinking || !input.trim()}
                className="px-4 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-40"
              >
                Send
              </button>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Say &ldquo;save it&rdquo; or &ldquo;looks good&rdquo; when you&rsquo;re happy and the alert will be {editingId ? "updated" : "created"} automatically.</div>
          </div>
        </div>
      )}

      <h2 className="text-sm font-semibold text-slate-300 mb-2">Active alerts</h2>
      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : alerts.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-500">
          <div className="text-3xl mb-2">🔔</div>
          <div className="text-sm">No alerts yet — click &ldquo;+ New alert&rdquo; above to set one up.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(a => (
            <div key={a.id} className={`border rounded-xl p-3 sm:p-4 ${a.active ? "border-slate-800 bg-slate-900/40" : "border-slate-800/40 bg-slate-900/20 opacity-60"}`}>
              <div className="min-w-0">
                {a.label && <div className="text-sm font-semibold text-slate-100">{a.label}</div>}
                <div className="text-sm text-slate-300 mt-0.5 line-clamp-3">{a.summary || a.intent || a.prompt || a.reminderText || "(no description)"}</div>
                <div className="text-[11px] text-slate-500 mt-2">
                  {a.kind === "reminder" ? describeReminder(a) : `Checked ${a.kind === "research" ? `every ${a.frequencyHours || 24}h` : "every 30 min"}`}
                  {a.lastFiredAt && <> · Last fired {new Date(a.lastFiredAt).toLocaleString("en-AU", { timeZone: "Australia/Brisbane", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</>}
                  {a.lastEvaluatedAt && !a.lastFiredAt && <> · Last checked {new Date(a.lastEvaluatedAt).toLocaleString("en-AU", { timeZone: "Australia/Brisbane", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                <button onClick={() => openEditChat(a)} className="text-xs px-2 py-1 rounded-md bg-slate-800 text-slate-300 hover:text-indigo-300 hover:bg-slate-700">Edit</button>
                <button onClick={() => sendTest(a)} className="text-xs px-2 py-1 rounded-md bg-slate-800 text-slate-300 hover:text-amber-300 hover:bg-slate-700" title="Send a sample triggered alert to your Inbox">Test</button>
                <button onClick={() => toggleActive(a)} className={`text-xs px-2 py-1 rounded-md ${a.active ? "bg-emerald-900/40 text-emerald-300 border border-emerald-800/50" : "bg-slate-800 text-slate-400"}`}>
                  {a.active ? "Active" : "Off"}
                </button>
                <button onClick={() => del(a)} className="text-xs px-2 py-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-slate-800/60 ml-auto">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
