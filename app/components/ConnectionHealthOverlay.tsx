"use client";

import { useEffect, useRef, useState } from "react";
import { useSiteName } from "./SiteProvider";

const POLL_MS = 3000;
const FAIL_THRESHOLD = 3;

type Phase = "ok" | "restarting";

export default function ConnectionHealthOverlay() {
  const siteName = useSiteName();
  const [phase, setPhase] = useState<Phase>("ok");
  const initialBuildIdRef = useRef<string | null>(null);
  const consecutiveFailsRef = useRef(0);
  const wasRestartingRef = useRef(false);
  // Don't show "restarting" overlay until we've successfully reached the
  // server at least once. Otherwise mobile cold-starts (slow connection,
  // SW boot) trip the threshold before the page is even usable.
  const everSucceededRef = useRef(false);

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
          // Build-id rebuild detection removed: was firing spuriously on
          // mobile when bfcache preserved the React ref across page shows,
          // making a normal cold start look like a deploy. Users always
          // get a fresh JS bundle on next hard load anyway.
          void data;
          if (wasRestartingRef.current) {
            window.location.reload();
            return;
          }
          everSucceededRef.current = true;
          consecutiveFailsRef.current = 0;
          setPhase("ok");
          return;
        }
      } catch {
        consecutiveFailsRef.current += 1;
      }
      if (cancelled) return;
      if (consecutiveFailsRef.current >= FAIL_THRESHOLD && everSucceededRef.current) {
        wasRestartingRef.current = true;
        setPhase("restarting");
      }
    };

    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id) return;
      tick();
      id = setInterval(tick, POLL_MS);
    };
    const stop = () => {
      if (id) { clearInterval(id); id = null; }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        consecutiveFailsRef.current = 0;
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (phase === "ok") return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center">
      <div className="max-w-md mx-4 rounded-lg border border-slate-700 bg-slate-900 px-6 py-5 text-center text-slate-100 shadow-xl">
        <div className="mb-3 flex justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-slate-600 border-t-amber-400 animate-spin" />
        </div>
        <h2 className="text-lg font-semibold mb-1">{siteName} restarting</h2>
        <p className="text-sm text-slate-400">The dashboard is reloading. This usually takes 10–20 seconds.</p>
      </div>
    </div>
  );
}
