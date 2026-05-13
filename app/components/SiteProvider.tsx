"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SiteConfig } from "@/lib/site-config";

const SiteContext = createContext<SiteConfig | null>(null);

export function SiteProvider({ value, children }: { value: SiteConfig; children: ReactNode }) {
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteConfig {
  const v = useContext(SiteContext);
  if (!v) {
    // Defensive fallback for renders outside the provider (test harnesses,
    // etc). Real apps should always have the provider in layout.tsx.
    return {
      name: "Mission Control",
      shortName: "MC",
      defaultAgentName: "Your Agent",
      accentColor: "#fafafa",
      logo: null,
      favicon: null,
      loginTagline: "AI OS for your business.",
    };
  }
  return v;
}

export function useSiteName(): string {
  return useSite().name;
}
