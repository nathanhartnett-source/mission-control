import fs from "fs";
import path from "path";
import { BRAND, BRAND_NAME, BRAND_THEME, BRAND_LOGO, BRAND_LOGO_SVG } from "./brand";

const FILE = path.join(process.cwd(), "data", "branding.json");

export type BrandingOverride = {
  name?: string;
  logoSvg?: string;
  logoDataUrl?: string;
};

export type BrandingResolved = {
  name: string;
  logoSvg?: string;
  logoDataUrl?: string;
  logo?: string;
  theme: typeof BRAND_THEME;
  brandKey: string;
};

export function readOverride(): BrandingOverride {
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function writeOverride(o: BrandingOverride): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(o, null, 2));
}

export function resolveBranding(): BrandingResolved {
  const o = readOverride();
  return {
    name: o.name?.trim() || BRAND_NAME,
    logoSvg: o.logoSvg ?? BRAND_LOGO_SVG,
    logoDataUrl: o.logoDataUrl,
    logo: BRAND_LOGO,
    theme: BRAND_THEME,
    brandKey: BRAND.key,
  };
}
