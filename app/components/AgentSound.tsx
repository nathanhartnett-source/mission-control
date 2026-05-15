"use client";

/**
 * Plays a short notification ding when the agent finishes a reply AND the MC
 * dashboard isn't the active window. Mounts globally via layout.tsx so it
 * works regardless of which app the user is currently inside.
 *
 * No audio asset needed — we synthesise a soft two-tone chime via Web Audio.
 */

import { useEffect, useRef } from "react";

const POLL_MS = 7000;
const SEEN_KEY = "mc-agent-sound-last-seen";

function nowAudioContext(): AudioContext | null {
  type WebkitWindow = typeof window & { webkitAudioContext?: typeof AudioContext };
  const w = window as WebkitWindow;
  const Ctor = w.AudioContext || w.webkitAudioContext;
  if (!Ctor) return null;
  try { return new Ctor(); } catch { return null; }
}

function playDing(ctx: AudioContext) {
  // Two soft sine pings ~A5 then E6, 60ms gap. Volume modest so it isn't
  // jarring when the user has the app in the background.
  const now = ctx.currentTime;
  const make = (freq: number, start: number, dur = 0.12, peak = 0.12) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(peak, now + start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + dur + 0.02);
  };
  make(880, 0);      // A5
  make(1318.5, 0.13); // E6
}

function isPageActive(): boolean {
  if (typeof document === "undefined") return true;
  if (document.visibilityState && document.visibilityState !== "visible") return false;
  if (typeof document.hasFocus === "function" && !document.hasFocus()) return false;
  return true;
}

export default function AgentSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const lastSeenRef = useRef<number>(0);
  // First poll establishes the baseline so we don't ding on initial mount
  // for messages that arrived hours ago.
  const baselineSetRef = useRef(false);

  useEffect(() => {
    try { lastSeenRef.current = parseInt(localStorage.getItem(SEEN_KEY) || "0", 10) || 0; } catch {}

    // Lazily create the AudioContext on the first user gesture (browsers
    // block autoplay until then) and resume it if suspended.
    const unlock = () => {
      if (!ctxRef.current) ctxRef.current = nowAudioContext();
      if (ctxRef.current && ctxRef.current.state === "suspended") ctxRef.current.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/agents/messages?self=1&limit=5", { cache: "no-store" });
        if (!r.ok || !alive) return;
        const d = await r.json();
        // Only consider rows whose run has finished — state must be "done"
        // (or "error", since a failed-reply ping is still useful). Skip
        // "queued" and "running" rows so we don't ding the moment the agent
        // starts thinking.
        const rows: { agent_ts?: string; state?: string }[] = d?.rows || [];
        const latest = rows
          .filter((x) => x.state === "done" || x.state === "error")
          .map((x) => (x.agent_ts ? new Date(x.agent_ts).getTime() : 0))
          .reduce((a, b) => Math.max(a, b), 0);
        if (!baselineSetRef.current) {
          // First-ever response: don't ding for already-existing messages.
          if (latest > lastSeenRef.current) lastSeenRef.current = latest;
          baselineSetRef.current = true;
          return;
        }
        if (latest > 0 && latest > lastSeenRef.current) {
          lastSeenRef.current = latest;
          try { localStorage.setItem(SEEN_KEY, String(latest)); } catch {}
          if (!isPageActive() && ctxRef.current) {
            try { playDing(ctxRef.current); } catch {}
          }
        }
      } catch {}
    };
    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return null;
}
