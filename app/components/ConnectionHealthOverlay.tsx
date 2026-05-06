"use client";

import { useEffect, useRef, useState } from "react";

const POLL_MS = 3000;
const FAIL_THRESHOLD = 3;

type Phase = "ok" | "restarting" | "rebuilt";

export default function ConnectionHealthOverlay() {
  const [phase, setPhase] = useState<Phase>("ok");
  const initialBuildIdRef = useRef<string | null>(null);
  const consecutiveFailsRef = useRef(0);
  const wasRestartingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          consecutiveFailsRef.current += 1;
        } else {
          const data = await res.json().catch(() => null) as { buildId?: string } | null;
          if (cancelled) return;
          const id = data?.buildId ?? null;
          if (initialBuildIdRef.current === null && id) {
            initialBuildIdRef.current = id;
          } else if (id && initialBuildIdRef.current && id !== initialBuildIdRef.current) {
            setPhase("rebuilt");
            return;
          }
          if (wasRestartingRef.current) {
            window.location.reload();
            return;
          }
          consecutiveFailsRef.current = 0;
          setPhase("ok");
          return;
        }
      } catch {
        consecutiveFailsRef.current += 1;
      }
      if (cancelled) return;
      if (consecutiveFailsRef.current >= FAIL_THRESHOLD) {
        wasRestartingRef.current = true;
        setPhase((p) => (p === "rebuilt" ? p : "restarting"));
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (phase === "ok") return null;

  const isRebuilt = phase === "rebuilt";
  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center">
      <div className="max-w-md mx-4 rounded-lg border border-slate-700 bg-slate-900 px-6 py-5 text-center text-slate-100 shadow-xl">
        <div className="mb-3 flex justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-slate-600 border-t-amber-400 animate-spin" />
        </div>
        <h2 className="text-lg font-semibold mb-1">
          {isRebuilt ? "Allhart MC updated" : "Allhart MC restarting"}
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          {isRebuilt
            ? "A new build went live. Reload to pick up the latest version."
            : "The dashboard is reloading. This usually takes 10–20 seconds."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded bg-amber-500 text-slate-950 font-medium hover:bg-amber-400 transition"
        >
          Reload now
        </button>
      </div>
    </div>
  );
}
