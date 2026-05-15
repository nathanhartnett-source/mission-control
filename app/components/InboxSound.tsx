"use client";

/**
 * Plays a louder, more attention-grabbing chime when a new inbox message
 * arrives. Distinct from AgentSound (which is a softer two-tone ping on
 * agent reply done). Mounts globally via layout.tsx.
 */

import { useEffect, useRef } from "react";

const POLL_MS = 7000;
const SEEN_KEY = "mc-inbox-sound-last-seen";

function nowAudioContext(): AudioContext | null {
  type WebkitWindow = typeof window & { webkitAudioContext?: typeof AudioContext };
  const w = window as WebkitWindow;
  const Ctor = w.AudioContext || w.webkitAudioContext;
  if (!Ctor) return null;
  try { return new Ctor(); } catch { return null; }
}

function playAlert(ctx: AudioContext) {
  // Louder, three-tone ascending alert. Distinct from AgentSound's softer
  // two-tone ping. Peak gain 0.35 (vs 0.12 in AgentSound).
  const now = ctx.currentTime;
  const make = (freq: number, start: number, dur = 0.18, peak = 0.35) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle"; // brighter than sine
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(peak, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + dur + 0.02);
  };
  make(659.25, 0);     // E5
  make(880, 0.18);     // A5
  make(1318.5, 0.36);  // E6
}

function isPageActive(): boolean {
  if (typeof document === "undefined") return true;
  if (document.visibilityState && document.visibilityState !== "visible") return false;
  if (typeof document.hasFocus === "function" && !document.hasFocus()) return false;
  return true;
}

export default function InboxSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const lastSeenRef = useRef<number>(0);
  const baselineSetRef = useRef(false);

  useEffect(() => {
    try { lastSeenRef.current = parseInt(localStorage.getItem(SEEN_KEY) || "0", 10) || 0; } catch {}

    const unlock = () => {
      if (!ctxRef.current) ctxRef.current = nowAudioContext();
      if (ctxRef.current && ctxRef.current.state === "suspended") ctxRef.current.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/inbox?limit=5", { cache: "no-store" });
        if (!r.ok || !alive) return;
        const d = await r.json();
        const rows: { ts?: string }[] = d?.messages || d?.rows || [];
        const latest = rows
          .map((x) => (x.ts ? new Date(x.ts).getTime() : 0))
          .reduce((a, b) => Math.max(a, b), 0);
        if (!baselineSetRef.current) {
          if (latest > lastSeenRef.current) lastSeenRef.current = latest;
          baselineSetRef.current = true;
          return;
        }
        if (latest > 0 && latest > lastSeenRef.current) {
          lastSeenRef.current = latest;
          try { localStorage.setItem(SEEN_KEY, String(latest)); } catch {}
          if (ctxRef.current) {
            try { playAlert(ctxRef.current); } catch {}
          }
        }
      } catch {}
    };
    tick();
    const id = window.setInterval(tick, POLL_MS);
    const onChange = () => tick();
    window.addEventListener("mc-inbox-changed", onChange);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("mc-inbox-changed", onChange);
    };
  }, []);

  return null;
}
