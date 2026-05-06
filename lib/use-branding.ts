"use client";

import { useEffect, useState } from "react";
import { BRAND_NAME, BRAND_LOGO_SVG, BRAND_LOGO } from "./brand";

export type ClientBranding = {
  name: string;
  logoSvg?: string;
  logoDataUrl?: string;
  logo?: string;
};

function fromWindow(): ClientBranding | null {
  if (typeof window === "undefined") return null;
  const w = (window as unknown as { __MC_BRANDING__?: ClientBranding }).__MC_BRANDING__;
  return w ?? null;
}

const FALLBACK: ClientBranding = {
  name: BRAND_NAME,
  logoSvg: BRAND_LOGO_SVG,
  logo: BRAND_LOGO,
};

export function useBranding(): ClientBranding {
  const [b, setB] = useState<ClientBranding>(() => fromWindow() ?? FALLBACK);
  useEffect(() => {
    const w = fromWindow();
    if (w) setB(w);
  }, []);
  return b;
}
