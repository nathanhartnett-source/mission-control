"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const SKIP = ["/login", "/register", "/auth"];

export default function SessionWatcher() {
  const pathname = usePathname() || "/";
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (SKIP.some((p) => pathname.startsWith(p))) return;

    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 401) setExpired(true);
      } catch {
        // network blip — ignore
      }
    };

    const onVisibility = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisibility);
    const id = setInterval(check, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(id);
    };
  }, [pathname]);

  if (!expired) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-rose-900/95 border-b border-rose-700 px-4 py-2.5 text-sm text-rose-100 flex items-center justify-between gap-4">
      <span>Your session has expired. Please log in again to continue.</span>
      <button
        onClick={() => { window.location.href = `/login?next=${encodeURIComponent(pathname)}`; }}
        className="px-3 py-1 rounded bg-rose-100 text-rose-900 font-medium hover:bg-white"
      >
        Log in
      </button>
    </div>
  );
}
