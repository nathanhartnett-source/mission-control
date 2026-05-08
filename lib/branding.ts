import fs from "fs";
import path from "path";
import { mcConfig } from "./mc-config";

// v2 semantic theme tokens. Each surface has a paired text colour so contrast
// is guaranteed. ~16 hex values total — enough granularity to look custom,
// few enough that admins can audit at a glance.
export type ThemeColors = Partial<{
  // Surfaces (with paired text)
  bgApp: string;        textApp: string;        // page background + body text
  bgSurface: string;    textSurface: string;    // cards, panels, dropdowns
  bgSidebar: string;    textSidebar: string;    // sidebar specifically
  bgBubbleUser: string; textBubbleUser: string; // user chat bubble
  bgBubbleAgent: string; textBubbleAgent: string; // agent chat bubble
  bgComposer: string;   textComposer: string;   // chat input + form fields
  // Atoms
  textMuted: string;    // timestamps, placeholders, captions
  textHeading: string;  // h1..h4 — defaults to textApp if unset
  textLink: string;     // links + accent text
  textSuccess: string;  // success / "saved" indicators
  textWarning: string;  // warnings / "thinking" pills
  textError: string;    // error messages
  borderDefault: string; borderSubtle: string;
  accent: string;       textOnAccent: string;   // primary buttons, links, active state
}>;

export const THEME_KEYS: (keyof ThemeColors)[] = [
  "bgApp", "textApp",
  "bgSurface", "textSurface",
  "bgSidebar", "textSidebar",
  "bgBubbleUser", "textBubbleUser",
  "bgBubbleAgent", "textBubbleAgent",
  "bgComposer", "textComposer",
  "textMuted",
  "textHeading", "textLink", "textSuccess", "textWarning", "textError",
  "borderDefault", "borderSubtle",
  "accent", "textOnAccent",
];

export type Branding = {
  logoPath: string | null;
  theme: ThemeColors;
  sourceUrl: string | null;
  updatedAt: string | null;
};

const FILE = path.join(mcConfig.dataRoot, "branding.json");

const DEFAULT: Branding = {
  logoPath: null,
  theme: {},
  sourceUrl: null,
  updatedAt: null,
};

export function readBranding(): Branding {
  try {
    const raw = fs.readFileSync(FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULT, ...parsed };
  } catch {
    return { ...DEFAULT };
  }
}

export function writeBranding(b: Partial<Branding>): Branding {
  const cur = readBranding();
  const next: Branding = {
    ...cur,
    ...b,
    theme: b.theme ? { ...cur.theme, ...b.theme } : cur.theme,
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2), "utf-8");
  return next;
}
