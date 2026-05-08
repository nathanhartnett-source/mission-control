import type { ThemeColors } from "./branding";

export type ThemePreset = { id: string; name: string; theme: ThemeColors };

// v2 token presets. Slate = default for fresh installs that skip URL detection.
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "slate",
    name: "Slate (default)",
    theme: {
      bgApp: "#1e293b", textApp: "#f1f5f9",
      bgSurface: "#334155", textSurface: "#f1f5f9",
      bgSidebar: "#0f172a", textSidebar: "#f1f5f9",
      bgBubbleUser: "#475569", textBubbleUser: "#ffffff",
      bgBubbleAgent: "#334155", textBubbleAgent: "#f1f5f9",
      bgComposer: "#334155", textComposer: "#f1f5f9",
      textMuted: "#94a3b8",
      textHeading: "#f8fafc", textLink: "#93c5fd",
      textSuccess: "#34d399", textWarning: "#fbbf24", textError: "#f87171",
      borderDefault: "#475569", borderSubtle: "#334155",
      accent: "#475569", textOnAccent: "#ffffff",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    theme: {
      bgApp: "#0f172a", textApp: "#e2e8f0",
      bgSurface: "#1e293b", textSurface: "#e2e8f0",
      bgSidebar: "#020617", textSidebar: "#e2e8f0",
      bgBubbleUser: "#6366f1", textBubbleUser: "#ffffff",
      bgBubbleAgent: "#1e293b", textBubbleAgent: "#e2e8f0",
      bgComposer: "#1e293b", textComposer: "#e2e8f0",
      textMuted: "#94a3b8",
      textHeading: "#f1f5f9", textLink: "#a5b4fc",
      textSuccess: "#34d399", textWarning: "#fbbf24", textError: "#f87171",
      borderDefault: "#334155", borderSubtle: "#1e293b",
      accent: "#6366f1", textOnAccent: "#ffffff",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    theme: {
      bgApp: "#0b2545", textApp: "#dbeafe",
      bgSurface: "#13315c", textSurface: "#dbeafe",
      bgSidebar: "#061a35", textSidebar: "#dbeafe",
      bgBubbleUser: "#0ea5e9", textBubbleUser: "#ffffff",
      bgBubbleAgent: "#13315c", textBubbleAgent: "#dbeafe",
      bgComposer: "#13315c", textComposer: "#dbeafe",
      textMuted: "#93c5fd",
      textHeading: "#eff6ff", textLink: "#7dd3fc",
      textSuccess: "#34d399", textWarning: "#fbbf24", textError: "#fca5a5",
      borderDefault: "#1e3a8a", borderSubtle: "#13315c",
      accent: "#0ea5e9", textOnAccent: "#ffffff",
    },
  },
  {
    id: "forest",
    name: "Forest",
    theme: {
      bgApp: "#1a2e1a", textApp: "#dcfce7",
      bgSurface: "#243d24", textSurface: "#dcfce7",
      bgSidebar: "#0d1f0d", textSidebar: "#dcfce7",
      bgBubbleUser: "#16a34a", textBubbleUser: "#ffffff",
      bgBubbleAgent: "#243d24", textBubbleAgent: "#dcfce7",
      bgComposer: "#243d24", textComposer: "#dcfce7",
      textMuted: "#86efac",
      textHeading: "#f0fdf4", textLink: "#86efac",
      textSuccess: "#4ade80", textWarning: "#fbbf24", textError: "#fca5a5",
      borderDefault: "#365e36", borderSubtle: "#243d24",
      accent: "#16a34a", textOnAccent: "#ffffff",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    theme: {
      bgApp: "#2a1410", textApp: "#fed7aa",
      bgSurface: "#3d1f1a", textSurface: "#fed7aa",
      bgSidebar: "#1a0a08", textSidebar: "#fed7aa",
      bgBubbleUser: "#f97316", textBubbleUser: "#ffffff",
      bgBubbleAgent: "#3d1f1a", textBubbleAgent: "#fed7aa",
      bgComposer: "#3d1f1a", textComposer: "#fed7aa",
      textMuted: "#fdba74",
      textHeading: "#fff7ed", textLink: "#fdba74",
      textSuccess: "#34d399", textWarning: "#fcd34d", textError: "#fca5a5",
      borderDefault: "#5a2e26", borderSubtle: "#3d1f1a",
      accent: "#f97316", textOnAccent: "#ffffff",
    },
  },
  {
    id: "mono",
    name: "Mono",
    theme: {
      bgApp: "#111111", textApp: "#e5e5e5",
      bgSurface: "#262626", textSurface: "#e5e5e5",
      bgSidebar: "#000000", textSidebar: "#e5e5e5",
      bgBubbleUser: "#525252", textBubbleUser: "#ffffff",
      bgBubbleAgent: "#262626", textBubbleAgent: "#e5e5e5",
      bgComposer: "#262626", textComposer: "#e5e5e5",
      textMuted: "#a3a3a3",
      textHeading: "#fafafa", textLink: "#d4d4d4",
      textSuccess: "#34d399", textWarning: "#fbbf24", textError: "#f87171",
      borderDefault: "#404040", borderSubtle: "#262626",
      accent: "#737373", textOnAccent: "#ffffff",
    },
  },
  {
    id: "plum",
    name: "Plum",
    theme: {
      bgApp: "#1e1033", textApp: "#e9d5ff",
      bgSurface: "#2d1b4e", textSurface: "#e9d5ff",
      bgSidebar: "#0f0820", textSidebar: "#e9d5ff",
      bgBubbleUser: "#a855f7", textBubbleUser: "#ffffff",
      bgBubbleAgent: "#2d1b4e", textBubbleAgent: "#e9d5ff",
      bgComposer: "#2d1b4e", textComposer: "#e9d5ff",
      textMuted: "#c4b5fd",
      textHeading: "#faf5ff", textLink: "#c4b5fd",
      textSuccess: "#34d399", textWarning: "#fbbf24", textError: "#fca5a5",
      borderDefault: "#3f2766", borderSubtle: "#2d1b4e",
      accent: "#a855f7", textOnAccent: "#ffffff",
    },
  },
];

export const DEFAULT_PRESET_ID = "slate";

export function getPreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id);
}
