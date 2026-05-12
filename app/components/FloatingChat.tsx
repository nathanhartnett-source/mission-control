"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useMe } from "./MeProvider";
import { marked } from "marked";

type Row = {
  corr_id: string;
  user_text?: string;
  user_ts?: string;
  agent_text?: string;
  agent_ts?: string;
  agent_state?: string;
};

const HIDE_ON = new Set<string>(["/agents", "/login", "/register", "/auth/result", "/onboarding"]);

function pageLabel(pathname: string): string {
  if (pathname === "/" || pathname === "") return "Home";
  const seg = pathname.split("/").filter(Boolean)[0] || "Home";
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
}

export default function FloatingChat() {
  const pathname = usePathname() || "/";
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Refs so the recorder's onstop sees latest send + text
  const sendRef = useRef<(override?: string) => Promise<void>>(async () => {});
  const textRef = useRef<string>("");

  const startRec = useCallback(async () => {
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
          if (!res.ok) { setErr("Transcription failed"); return; }
          const d = await res.json() as { text?: string };
          const t = (d.text || "").trim();
          if (t) {
            const existing = (textRef.current || "").trim();
            const combined = existing ? existing + " " + t : t;
            setText("");
            await sendRef.current(combined);
          }
        } catch { setErr("Transcription error"); }
        finally { setTranscribing(false); }
      };
      mr.start();
      setRecording(true);
    } catch { setErr("Mic access denied"); }
  }, []);

  const stopRec = useCallback(() => {
    const mr = recorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    setRecording(false);
  }, []);

  const hidden = HIDE_ON.has(pathname) || !me;
  // Prefer per-user agentName (single-agent model); fall back to admin's agentNames.me; finally "Your agent".
  const agentName = (me?.agentName as string) || (me?.agentNames?.["me"] as string) || "Your agent";

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/agents/messages?limit=30&self=1", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      if (Array.isArray(d?.rows)) setRows(d.rows);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!open || hidden) return;
    refresh();
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/agents/messages/stream");
      es.addEventListener("ping", () => refresh());
    } catch { /* ignore */ }
    const fallback = window.setInterval(refresh, 30000);
    return () => {
      if (es) es.close();
      window.clearInterval(fallback);
    };
  }, [open, hidden, refresh]);

  // Autoscroll on row count OR text growth (agent reply lands in an existing
  // row by corr_id; rows.length doesn't change but text does).
  const contentFingerprint = rows.map((r) => `${r.corr_id}:${r.agent_state || ""}:${(r.agent_text || "").length}:${(r.user_text || "").length}`).join("|");
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, contentFingerprint]);

  useEffect(() => { textRef.current = text; }, [text]);

  const send = useCallback(async (override?: string) => {
    const t = (override ?? text).trim();
    if (!t || sending) return;
    setSending(true);
    setErr(null);
    try {
      const ctx = `[User is on the ${pageLabel(pathname)} page]`;
      // Single-agent model: always use the per-user "me" agent, regardless of admin status.
      const targetAgent = "me";
      const r = await fetch(`/api/agents/${targetAgent}/enqueue`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: `${ctx}\n\n${t}`, confirmed: true, attachments: [] }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setErr(d?.error || `HTTP ${r.status}`);
      } else {
        setText("");
        refresh();
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setSending(false);
    }
  }, [text, sending, pathname, refresh, me?.isAdmin]);

  useEffect(() => { sendRef.current = send; }, [send]);

  if (hidden) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={`Ask ${agentName}`}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 h-12 w-12 md:h-14 md:w-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40 flex items-center justify-center transition active:scale-95"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}
      {open && (
        <div className="fixed bottom-20 right-3 left-3 h-[60vh] max-h-[440px] md:bottom-6 md:right-6 md:left-auto md:h-[560px] md:max-h-none md:w-[380px] z-50 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-100">{agentName}</span>
              <span className="text-[11px] text-slate-400">on {pageLabel(pathname)}</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-slate-400 hover:text-slate-200 p-1"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-2 scroll-pretty">
            {rows.length === 0 && (
              <div className="text-xs text-slate-500 text-center py-8">
                Ask {agentName} about this page.
              </div>
            )}
            {rows.slice(-30).flatMap((r) => {
              const items: React.ReactNode[] = [];
              const userText = (r.user_text || "").replace(/^\[User is on the [^\]]+\]\n+/, "").trim();
              if (userText) {
                items.push(
                  <div key={`${r.corr_id}-u`} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words bg-indigo-600 text-white">
                      {userText}
                    </div>
                  </div>
                );
              }
              const agentText = (r.agent_text || "").trim();
              const isRunning = r.agent_state === "running" || r.agent_state === "queued";
              if (agentText || isRunning) {
                items.push(
                  <div key={`${r.corr_id}-a`} className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed break-words bg-slate-800 text-slate-100
                      [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                      [&_p]:my-1
                      [&_strong]:font-semibold [&_strong]:text-white
                      [&_em]:italic
                      [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1
                      [&_li]:my-0
                      [&_code]:text-amber-300 [&_code]:bg-slate-900/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                      [&_pre]:bg-slate-900 [&_pre]:border [&_pre]:border-slate-700 [&_pre]:rounded [&_pre]:p-2 [&_pre]:overflow-x-auto [&_pre]:my-1.5 [&_pre>code]:bg-transparent [&_pre>code]:px-0
                      [&_a]:text-indigo-300 hover:[&_a]:underline">
                      {agentText
                        ? <span dangerouslySetInnerHTML={{ __html: marked.parse(agentText, { breaks: true, gfm: true }) as string }} />
                        : <span className="text-amber-300 tabular-nums">thinking…</span>}
                    </div>
                  </div>
                );
              }
              return items;
            })}
          </div>
          {err && <div className="px-3 pb-1 text-[11px] text-rose-400">{err}</div>}
          <div className="border-t border-slate-700 p-2 flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`Ask ${agentName}…`}
              rows={1}
              className="flex-1 resize-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 max-h-32"
            />
            <button
              onClick={recording ? stopRec : startRec}
              disabled={sending || transcribing}
              title={recording ? "Stop recording" : "Voice message"}
              className={`rounded-lg px-3 py-2 text-sm font-medium flex items-center justify-center ${recording ? "bg-rose-600 text-white hover:bg-rose-500 animate-pulse" : "bg-slate-800 text-slate-300 hover:bg-slate-700"} disabled:opacity-40`}
            >
              {transcribing ? "…" : recording ? "■" : "🎤"}
            </button>
            <button
              onClick={() => send()}
              disabled={!text.trim() || sending}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 text-sm text-white font-medium"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
