"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const SKIP_PATHS = ["/login", "/register", "/auth/result", "/onboarding"];

export default function OnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (SKIP_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"))) return;
    let cancelled = false;
    fetch("/api/auth/me").then(async r => {
      if (cancelled || !r.ok) return;
      const data = await r.json();
      if (data?.user && data.user.personaCompleted === false) {
        router.replace("/onboarding");
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [pathname, router]);

  return null;
}
