"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

// ── Inline icons (avoid adding an icon lib) ───────────────────────────────────
const Icon = (d: string, size = 16) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const PlusIcon      = ({ size = 16 }: { size?: number }) => Icon("M12 5v14M5 12h14", size);
const XIcon         = ({ size = 16 }: { size?: number }) => Icon("M18 6 6 18M6 6l12 12", size);
const ArrowLeftIcon = ({ size = 13 }: { size?: number }) => Icon("M19 12H5m0 0 6-6m-6 6 6 6", size);
const CheckIcon     = ({ size = 11 }: { size?: number }) => Icon("M5 12l5 5L20 7", size);
const TrashIcon     = ({ size = 13 }: { size?: number }) => Icon("M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", size);
const GripIcon      = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="9"  cy="6"  r="1.6" />
    <circle cx="15" cy="6"  r="1.6" />
    <circle cx="9"  cy="12" r="1.6" />
    <circle cx="15" cy="12" r="1.6" />
    <circle cx="9"  cy="18" r="1.6" />
    <circle cx="15" cy="18" r="1.6" />
  </svg>
);
const SettingsIcon  = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

// ── Tokens (bento theme) ─────────────────────────────────────────────────────
const T = {
  pageBg:        "var(--bento-page-bg, #0a0a0a)",
  cardBg:        "var(--bento-card-bg, #131313)",
  cardBgElev:    "var(--bento-card-bg-elev, #1a1a1a)",
  border:        "var(--bento-border, #262626)",
  borderSoft:    "var(--bento-border-soft, rgba(255,255,255,0.08))",
  accent:        "var(--bento-accent, #fafafa)",
  accentSoft:    "var(--bento-accent-soft, rgba(255,255,255,0.1))",
  textPrimary:   "var(--bento-text-primary, #fafafa)",
  textSecondary: "var(--bento-text-secondary, #a0a0a0)",
  textMuted:     "var(--bento-text-muted, rgba(255,255,255,0.4))",
};

const ACCENT_SWATCHES = [
  { hex: "", label: "Default" },
  { hex: "#60a5fa", label: "Blue" },
  { hex: "#34d399", label: "Green" },
  { hex: "#fbbf24", label: "Amber" },
  { hex: "#f87171", label: "Red" },
  { hex: "#c084fc", label: "Purple" },
  { hex: "#f472b6", label: "Pink" },
  { hex: "#22d3ee", label: "Cyan" },
  { hex: "#fb923c", label: "Orange" },
];

type Priority = "none" | "green" | "amber" | "red";
const PRIORITY_COLORS: Record<Priority, string> = {
  none:  "rgba(255,255,255,0.22)",
  green: "#34d399",
  amber: "#fbbf24",
  red:   "#f87171",
};
const NEXT_PRIORITY: Record<Priority, Priority> = {
  none: "green", green: "amber", amber: "red", red: "none",
};

interface Task {
  id: string;
  text: string;
  priority: Priority;
  done: boolean;
}

interface ProjectModule {
  id: string;
  title: string;
  accent: string; // "" = default
  tasks: Task[];
}

const API_PATH = "/api/bento-modules";

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

async function loadModules(): Promise<{ ok: boolean; data: ProjectModule[] }> {
  try {
    const res = await fetch(API_PATH, { cache: "no-store" });
    if (!res.ok) return { ok: false, data: [] };
    const data = await res.json();
    return { ok: Array.isArray(data), data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, data: [] };
  }
}

async function saveModules(mods: ProjectModule[]): Promise<void> {
  try {
    await fetch(API_PATH, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mods),
    });
  } catch {}
}

// Derive a full tinted palette from a hex.
// When accent is set, re-tint the whole card (bg, border, text) — not just the accent.
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let s = 0;
  let hue = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hue = (g - b) / d + (g < b ? 6 : 0); break;
      case g: hue = (b - r) / d + 2; break;
      case b: hue = (r - g) / d + 4; break;
    }
    hue *= 60;
  }
  return { h: Math.round(hue), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function accentVars(hex: string): CSSProperties {
  if (!hex) return {};
  const { h, s } = hexToHsl(hex);
  const m = s < 8 ? 0 : 1; // greyscale if user picks a near-neutral colour
  const hsl  = (H: number, S: number, L: number) => `hsl(${H} ${S}% ${L}%)`;
  const hsla = (H: number, S: number, L: number, A: number) => `hsla(${H} ${S}% ${L}% / ${A})`;
  return {
    ["--bento-card-bg" as string]:        hsl(h, 27 * m, 14),
    ["--bento-card-bg-elev" as string]:   hsl(h, 24 * m, 18),
    ["--bento-border" as string]:         hsl(h, 27 * m, 33),
    ["--bento-border-soft" as string]:    hsla(h, 60 * m, 50, 0.25),
    ["--bento-accent" as string]:         hex,
    ["--bento-accent-soft" as string]:    hsla(h, 70 * m, 55, 0.14),
    ["--bento-text-primary" as string]:   hsl(h, 40 * m, 93),
    ["--bento-text-secondary" as string]: hsl(h, 24 * m, 72),
    ["--bento-text-muted" as string]:     hsla(h, 20 * m, 85, 0.45),
  };
}

// ── Card shell with flip ──────────────────────────────────────────────────────

function FlipCard({
  front, back, flipped, style,
}: {
  front: React.ReactNode;
  back: React.ReactNode;
  flipped: boolean;
  style?: CSSProperties;
}) {
  const frontRef = useRef<HTMLDivElement | null>(null);
  const backRef  = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const active = flipped ? backRef.current : frontRef.current;
    if (!active) return;
    const update = () => setHeight(active.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(active);
    return () => ro.disconnect();
  }, [flipped]);

  return (
    <div
      className="flip-card"
      data-flipped={flipped ? "true" : "false"}
      style={{ ...style, height }}
    >
      <div ref={frontRef} className="flip-face flip-front">{front}</div>
      <div ref={backRef}  className="flip-face flip-back">{back}</div>
    </div>
  );
}

const faceStyle: CSSProperties = {
  background: T.cardBg,
  border: `1px solid ${T.border}`,
  borderRadius: 20,
  padding: "18px 18px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  color: T.textPrimary,
};

const iconBtn: CSSProperties = {
  background: "transparent",
  border: "none",
  color: T.textMuted,
  cursor: "pointer",
  padding: 4,
  borderRadius: 6,
  display: "flex",
  alignItems: "center",
};

// ── Project module ────────────────────────────────────────────────────────────

function ProjectModuleCard({
  mod, onChange, onDelete, dragHandlers,
}: {
  mod: ProjectModule;
  onChange: (m: ProjectModule) => void;
  onDelete: () => void;
  dragHandlers?: {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
  };
}) {
  const [flipped, setFlipped] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");

  const updateTitle = (title: string) => onChange({ ...mod, title });
  const setAccent   = (hex: string)   => onChange({ ...mod, accent: hex });

  const addTask = () => {
    const text = newTaskText.trim();
    if (!text) return;
    const task: Task = { id: newId(), text, priority: "none", done: false };
    onChange({ ...mod, tasks: [...mod.tasks, task] });
    setNewTaskText("");
  };
  const toggleTask = (id: string) => {
    onChange({
      ...mod,
      tasks: mod.tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t),
    });
  };
  const cyclePriority = (id: string) => {
    onChange({
      ...mod,
      tasks: mod.tasks.map((t) => t.id === id ? { ...t, priority: NEXT_PRIORITY[t.priority] } : t),
    });
  };
  const removeTask = (id: string) => {
    onChange({ ...mod, tasks: mod.tasks.filter((t) => t.id !== id) });
  };

  const done    = mod.tasks.filter((t) => t.done).length;
  const total   = mod.tasks.length;

  const front = (
    <div style={faceStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <input
          value={mod.title}
          onChange={(e) => updateTitle(e.target.value)}
          placeholder="Project name"
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: "none",
            outline: "none",
            color: T.textPrimary,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "-0.2px",
            padding: 0,
          }}
        />
        <div style={{ display: "flex", gap: 2 }}>
          {dragHandlers && (
            <button
              aria-label="Drag to reorder"
              title="Drag to reorder"
              draggable
              onDragStart={dragHandlers.onDragStart}
              onDragEnd={dragHandlers.onDragEnd}
              style={{ ...iconBtn, cursor: "grab" }}
            >
              <GripIcon size={15} />
            </button>
          )}
          <button onClick={() => setFlipped(true)} aria-label="Module settings" style={iconBtn}>
            <SettingsIcon size={15} />
          </button>
          <button onClick={onDelete} aria-label="Remove module" style={iconBtn}>
            <XIcon size={16} />
          </button>
        </div>
      </div>

      {total > 0 && (
        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>
          {done}/{total} done
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {mod.tasks.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              background: "rgba(0,0,0,0.22)",
              border: `1px solid ${T.borderSoft}`,
              borderRadius: 10,
            }}
          >
            <button
              onClick={() => cyclePriority(t.id)}
              aria-label={`Priority ${t.priority}`}
              title={`Priority: ${t.priority}`}
              className="bento-tap"
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: PRIORITY_COLORS[t.priority],
                border: t.priority === "none" ? `1px solid ${T.borderSoft}` : "none",
                cursor: "pointer",
                flexShrink: 0,
                padding: 0,
              }}
            />
            <input
              type="checkbox"
              checked={t.done}
              onChange={() => toggleTask(t.id)}
              style={{ cursor: "pointer", accentColor: "#fff", flexShrink: 0 }}
            />
            <span style={{
              flex: 1,
              minWidth: 0,
              fontSize: 13,
              lineHeight: 1.35,
              color: t.done ? T.textMuted : T.textPrimary,
              textDecoration: t.done ? "line-through" : "none",
              wordBreak: "break-word",
            }}>
              {t.text}
            </span>
            <button
              onClick={() => removeTask(t.id)}
              aria-label="Remove task"
              style={{ ...iconBtn, padding: 2 }}
            >
              <XIcon size={13} />
            </button>
          </div>
        ))}

        {total === 0 && (
          <p style={{ fontSize: 12, color: T.textMuted, margin: "4px 0" }}>
            No tasks yet. Add one below.
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); addTask(); }}
        style={{ display: "flex", gap: 6 }}
      >
        <input
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          placeholder="Add task…"
          style={{
            flex: 1,
            minWidth: 0,
            background: "rgba(0,0,0,0.24)",
            border: `1px solid ${T.borderSoft}`,
            borderRadius: 10,
            padding: "8px 10px",
            color: T.textPrimary,
            fontSize: 13,
            outline: "none",
          }}
        />
        <button
          type="submit"
          aria-label="Add task"
          className="bento-tap"
          style={{
            background: T.accentSoft,
            border: `1px solid ${T.borderSoft}`,
            borderRadius: 10,
            color: T.accent,
            cursor: "pointer",
            padding: "0 10px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <PlusIcon size={15} />
        </button>
      </form>
    </div>
  );

  const back = (
    <div style={faceStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          onClick={() => setFlipped(false)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: "transparent", border: "none",
            color: T.textSecondary, fontSize: 12, fontWeight: 700,
            cursor: "pointer", padding: 0,
          }}
        >
          <ArrowLeftIcon size={13} /> Back
        </button>
        <div style={{
          fontSize: 10, color: T.textMuted, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "1px",
        }}>
          Settings
        </div>
      </div>

      <div style={{
        fontSize: 11, color: T.textSecondary, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "1px",
      }}>
        Module colour
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {ACCENT_SWATCHES.map((s) => {
          const active = mod.accent === s.hex;
          if (s.hex === "") {
            return (
              <button
                key="default"
                onClick={() => setAccent("")}
                title={s.label}
                style={{
                  width: 28, height: 28, borderRadius: 999,
                  border: `2px dashed ${active ? T.accent : T.borderSoft}`,
                  background: "transparent", color: T.textMuted,
                  cursor: "pointer", fontSize: 9, fontWeight: 700,
                }}
              >
                {active ? "✓" : "·"}
              </button>
            );
          }
          return (
            <button
              key={s.hex}
              onClick={() => setAccent(s.hex)}
              title={s.label}
              style={{
                width: 28, height: 28, borderRadius: 999,
                background: s.hex, border: "none", cursor: "pointer",
                position: "relative",
                boxShadow: active ? `0 0 0 2px ${T.cardBg}, 0 0 0 4px #fff` : "none",
              }}
            >
              {active && <span style={{ position: "absolute", top: 7, left: 7, color: "#fff" }}><CheckIcon size={12} /></span>}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      <button
        onClick={onDelete}
        className="bento-tap"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          background: "transparent",
          border: `1px solid ${T.borderSoft}`,
          color: "#f87171",
          padding: "9px 14px",
          borderRadius: 999,
          fontSize: 12, fontWeight: 700,
          cursor: "pointer",
        }}
      >
        <TrashIcon size={13} /> Delete module
      </button>
    </div>
  );

  return (
    <FlipCard
      flipped={flipped}
      front={front}
      back={back}
      style={accentVars(mod.accent)}
    />
  );
}

// ── Add module tile ───────────────────────────────────────────────────────────

function AddModuleTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bento-tap"
      style={{
        width: "100%",
        background: "transparent",
        border: `1.5px dashed ${T.border}`,
        borderRadius: 20,
        padding: "28px 18px",
        color: T.textMuted,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        minHeight: 120,
        justifyContent: "center",
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: T.accentSoft,
        border: `1px solid ${T.borderSoft}`,
        color: T.textPrimary,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <PlusIcon size={20} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.textSecondary }}>
        Add project module
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [modules, setModules] = useState<ProjectModule[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [initialLoadSucceeded, setInitialLoadSucceeded] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { ok, data } = await loadModules();
      if (alive) {
        if (ok) {
          setModules(data);
          setInitialLoadSucceeded(true);
        }
        setHydrated(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Poll every 10s so server-side changes show up without a manual refresh.
  useEffect(() => {
    if (!hydrated) return;
    const t = setInterval(async () => {
      const { ok, data } = await loadModules();
      if (!ok) return;
      setInitialLoadSucceeded(true);
      setModules((prev) => {
        // Don't clobber in-flight local edits: only update if server differs
        // from our last-known state.
        return JSON.stringify(prev) === JSON.stringify(data) ? prev : data;
      });
    }, 10000);
    return () => clearInterval(t);
  }, [hydrated]);

  useEffect(() => {
    if (hydrated && initialLoadSucceeded && dirty) {
      void saveModules(modules);
      setDirty(false);
    }
  }, [modules, hydrated, initialLoadSucceeded, dirty]);

  const addModule = useCallback(() => {
    setDirty(true);
    setModules((prev) => [
      ...prev,
      { id: newId(), title: "", accent: "", tasks: [] },
    ]);
  }, []);

  const updateModule = useCallback((id: string, next: ProjectModule) => {
    setDirty(true);
    setModules((prev) => prev.map((m) => m.id === id ? next : m));
  }, []);

  const deleteModule = useCallback((id: string) => {
    setDirty(true);
    setModules((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Drag & drop — reorders the modules array. Re-saves via the dirty flag.
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const handleDragStart = useCallback((id: string) => (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDraggedId(id);
  }, []);
  const handleDragEnd = useCallback(() => (_e: React.DragEvent) => {
    setDraggedId(null);
    setDropTargetId(null);
  }, []);
  const handleDragOver = useCallback((id: string) => (e: React.DragEvent) => {
    if (!draggedId || draggedId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetId(id);
  }, [draggedId]);
  const handleDragLeave = useCallback((id: string) => (_e: React.DragEvent) => {
    setDropTargetId((cur) => (cur === id ? null : cur));
  }, []);
  const handleDrop = useCallback((targetId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain") || draggedId;
    setDraggedId(null);
    setDropTargetId(null);
    if (!sourceId || sourceId === targetId) return;
    setDirty(true);
    setModules((prev) => {
      const src = prev.findIndex((m) => m.id === sourceId);
      const dst = prev.findIndex((m) => m.id === targetId);
      if (src < 0 || dst < 0) return prev;
      const next = prev.slice();
      const [moved] = next.splice(src, 1);
      next.splice(dst, 0, moved);
      return next;
    });
  }, [draggedId]);

  return (
    <div style={{ minHeight: "100vh", background: `var(--bento-page-bg, ${T.pageBg})`, padding: "24px 20px 60px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{
            fontSize: 20, fontWeight: 800, color: T.textPrimary,
            letterSpacing: "-0.3px", margin: 0,
          }}>
            Projects
          </h1>
          <p style={{ fontSize: 12, color: T.textMuted, margin: "4px 0 0" }}>
            {modules.length} module{modules.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="bento-masonry">
          {modules.map((m) => (
            <div
              key={m.id}
              data-dragging={draggedId === m.id ? "1" : undefined}
              data-drop-target={dropTargetId === m.id ? "1" : undefined}
              onDragOver={handleDragOver(m.id)}
              onDragLeave={handleDragLeave(m.id)}
              onDrop={handleDrop(m.id)}
            >
              <ProjectModuleCard
                mod={m}
                onChange={(next) => updateModule(m.id, next)}
                onDelete={() => deleteModule(m.id)}
                dragHandlers={{
                  draggable: true,
                  onDragStart: handleDragStart(m.id),
                  onDragEnd: handleDragEnd(),
                }}
              />
            </div>
          ))}
          <AddModuleTile onClick={addModule} />
        </div>
      </div>
    </div>
  );
}
