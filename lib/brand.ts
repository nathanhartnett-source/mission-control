/**
 * Per-tenant brand resolver. Set NEXT_PUBLIC_BRAND at build/start time
 * (e.g. `NEXT_PUBLIC_BRAND=obt`) to override the default Allhart branding.
 *
 * Values are exposed via NEXT_PUBLIC_* so they're available client-side
 * without a separate API hop.
 */

export type BrandKey = "allhart" | "obt";

type BrandConfig = {
  key: BrandKey;
  name: string;
  logo?: string;
  defaultTheme: {
    dashboardBg: string;
    sidebarBg: string;
    textColor: string;
    userBubbleBg: string;
    agentBubbleBg: string;
    chatWindowBg: string;
  };
};

const BRANDS: Record<BrandKey, BrandConfig> = {
  allhart: {
    key: "allhart",
    name: "Allhart MC",
    defaultTheme: {
      dashboardBg:   "#0f172a",
      sidebarBg:     "#020617",
      textColor:     "#e2e8f0",
      userBubbleBg:  "#6366f1",
      agentBubbleBg: "#1e293b",
      chatWindowBg:  "#0f172a",
    },
  },
  obt: {
    key: "obt",
    name: "OBT MC",
    logo: "/brand/obt-logo.svg",
    // Sourced from obt.com.au: primary #195985 (deep blue),
    // accent #ef3f56 (coral red), tertiary #DBD56E (gold).
    defaultTheme: {
      dashboardBg:   "#0a1929",
      sidebarBg:     "#061121",
      textColor:     "#e2e8f0",
      userBubbleBg:  "#195985",
      agentBubbleBg: "#1a2b3d",
      chatWindowBg:  "#0a1929",
    },
  },
};

function resolveKey(): BrandKey {
  const raw = (process.env.NEXT_PUBLIC_BRAND || "").toLowerCase();
  if (raw === "obt") return "obt";
  return "allhart";
}

export const BRAND: BrandConfig = BRANDS[resolveKey()];
export const BRAND_NAME = BRAND.name;
export const BRAND_LOGO = BRAND.logo;
export const BRAND_THEME = BRAND.defaultTheme;
