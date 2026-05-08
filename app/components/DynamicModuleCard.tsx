"use client";

import { useCallback, useEffect, useState } from "react";

interface ModuleEntry {
  id: string;
  type: "counter" | "checklist" | "number_log" | "text_note" | "toggle";
  subtype?: string;
  label: string;
  emoji: string;
  unit?: string;
  goal?: number;
  items?: string[];
  addedAt: string;
  dataFile: string;
  person: "nathan" | "tessa" | "karl" | "tracy";
}

interface LogEntry {
  value: unknown;
  loggedAt: string;
}

const btnBase =
  "rounded-lg transition-all duration-150 font-medium focus:outline-none focus:ring-2 focus:ring-accent/40";

// ── Helpers ────────────────────────────────────────────────────────

function parseSafe(val: unknown): Record<string, unknown> {
  try { return JSON.parse(String(val)) as Record<string, unknown>; }
  catch { return { raw: String(val) }; }
}

function fmtTime(ts: string) {
  return new Date(ts)
    .toLocaleTimeString("en-AU", {
      timeZone: "Australia/Brisbane",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase()
    .replace(/\s/g, "");
}

function fmtAgo(ts: string) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ago`;
}

function tintPalette(accent: string) {
  const r = parseInt(accent.slice(1, 3), 16);
  const g = parseInt(accent.slice(3, 5), 16);
  const b = parseInt(accent.slice(5, 7), 16);
  const cardBg = `rgba(${r},${g},${b},0.12)`;
  const cardBg2 = `rgba(${r},${g},${b},0.18)`;
  const inputBg = `rgba(${r},${g},${b},0.08)`;
  const borderColor = `rgba(${r},${g},${b},0.35)`;
  const borderHover = `rgba(${r},${g},${b},0.6)`;
  const trackBg = `rgba(${r},${g},${b},0.1)`;
  const textSecondary = `rgba(${Math.min(r + 150, 255)},${Math.min(g + 150, 255)},${Math.min(b + 150, 255)},0.85)`;
  const accentDim = `rgba(${r},${g},${b},0.6)`;
  const accentFaint = `rgba(${r},${g},${b},0.2)`;
  return { cardBg, cardBg2, inputBg, borderColor, borderHover, trackBg, textSecondary, accentDim, accentFaint };
}

function ProgressBar({ value, goal, accent }: { value: number; goal: number; accent: string }) {
  const pct = Math.min(100, Math.round((value / goal) * 100));
  const palette = tintPalette(accent);
  return (
    <div className="rounded-full overflow-hidden" style={{ height: "8px", background: palette.trackBg, margin: "6px 0" }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: accent }}
      />
    </div>
  );
}

function QuickPills({
  options,
  onSelect,
  accent,
  selected,
}: {
  options: { label: string; value: number }[];
  onSelect: (v: number) => void;
  accent: string;
  selected?: number;
}) {
  const palette = tintPalette(accent);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
      {options.map((o) => (
        <button
          key={o.label}
          onClick={() => onSelect(o.value)}
          style={{
            padding: "5px 12px",
            borderRadius: "8px",
            border: `1px solid ${selected === o.value ? accent : palette.borderColor}`,
            background: selected === o.value ? accent : palette.cardBg2,
            color: selected === o.value ? "#fff" : palette.textSecondary,
            fontSize: "13px",
            cursor: "pointer",
            fontWeight: selected === o.value ? 600 : 400,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Subtype UIs ────────────────────────────────────────────────────

function MoodScale({
  todayEntries, logValue, logging, accent,
}: { todayEntries: LogEntry[]; logValue: (v: unknown) => void; logging: boolean; accent: string }) {
  const palette = tintPalette(accent);
  const moods = [
    { emoji: "😞", value: 1, label: "Rough" },
    { emoji: "😕", value: 2, label: "Meh" },
    { emoji: "😐", value: 3, label: "Okay" },
    { emoji: "🙂", value: 4, label: "Good" },
    { emoji: "😄", value: 5, label: "Great" },
  ];
  const lastEntry = todayEntries[todayEntries.length - 1];
  const lastVal = typeof lastEntry?.value === "number" ? lastEntry.value : null;

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", marginBottom: "10px" }}>
        {moods.map(({ emoji, value, label }) => {
          const active = lastVal === value;
          return (
            <button
              key={value}
              onClick={() => !logging && logValue(value)}
              title={label}
              style={{
                flex: 1,
                padding: "10px 4px",
                borderRadius: "10px",
                border: `2px solid ${active ? accent : palette.borderColor}`,
                background: active ? `${accent}22` : palette.inputBg,
                fontSize: "22px",
                cursor: logging ? "not-allowed" : "pointer",
                opacity: logging ? 0.5 : 1,
                transition: "all 0.15s ease",
              }}
            >
              {emoji}
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: "13px", color: palette.textSecondary, margin: 0 }}>
        {lastVal
          ? `Today's mood: ${moods.find((m) => m.value === lastVal)?.emoji} ${moods.find((m) => m.value === lastVal)?.label}`
          : "No check-in yet"}
      </p>
    </div>
  );
}

function SleepTracker({
  todayEntries, allEntries, logValue, logging, accent, goal,
}: { todayEntries: LogEntry[]; allEntries: LogEntry[]; logValue: (v: unknown) => void; logging: boolean; accent: string; goal: number }) {
  const palette = tintPalette(accent);
  const [custom, setCustom] = useState("");
  const [selected, setSelected] = useState<number | undefined>();
  const quickOpts = [4, 5, 6, 7, 8, 9].map((h) => ({ label: `${h}h`, value: h }));

  const lastEntry = allEntries[allEntries.length - 1];
  const todayVal = typeof todayEntries[todayEntries.length - 1]?.value === "number"
    ? (todayEntries[todayEntries.length - 1].value as number) : null;

  const doLog = (val: number) => {
    setSelected(val);
    logValue(val);
    setCustom("");
  };

  return (
    <div>
      <QuickPills options={quickOpts} onSelect={doLog} accent={accent} selected={selected ?? (todayVal ?? undefined)} />
      <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
        <input
          type="number"
          placeholder="Custom (e.g. 7.5)"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          step="0.5"
          min="0"
          max="24"
          style={{ flex: 1, background: palette.inputBg, border: `1px solid ${palette.borderColor}`, borderRadius: "8px", padding: "7px 10px", color: "#e8f5e8", fontSize: "13px", outline: "none" }}
        />
        {custom && (
          <button
            onClick={() => { const v = parseFloat(custom); if (!isNaN(v)) doLog(v); }}
            disabled={logging}
            style={{ background: accent, color: "#fff", border: "none", borderRadius: "8px", padding: "7px 14px", fontSize: "13px", cursor: "pointer", fontWeight: 600 }}
          >
            Log
          </button>
        )}
      </div>
      {todayVal !== null && (
        <>
          <ProgressBar value={todayVal} goal={goal} accent={accent} />
          <p style={{ fontSize: "12px", color: palette.textSecondary, margin: "4px 0 0" }}>
            {todayVal}h / {goal}h goal
          </p>
        </>
      )}
      {!todayVal && lastEntry && (
        <p style={{ fontSize: "12px", color: palette.accentDim, margin: "4px 0 0" }}>
          Last night: {String(lastEntry.value)}h · {fmtTime(lastEntry.loggedAt)}
        </p>
      )}
    </div>
  );
}

function WorkoutLogger({
  todayEntries, logValue, logging, accent,
}: { todayEntries: LogEntry[]; logValue: (v: unknown) => void; logging: boolean; accent: string }) {
  const palette = tintPalette(accent);
  const types = ["🏃 Run", "🚴 Cycle", "🏋️ Weights", "🧘 Yoga", "🏊 Swim", "💪 Other"];
  const intensities = ["Easy", "Moderate", "Hard"];
  const [wType, setWType] = useState("");
  const [duration, setDuration] = useState("");
  const [intensity, setIntensity] = useState("Moderate");

  const canLog = wType && duration;

  const doLog = () => {
    if (!canLog) return;
    logValue(JSON.stringify({ type: wType, durationMin: parseInt(duration), intensity }));
    setWType("");
    setDuration("");
    setIntensity("Moderate");
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
        {types.map((t) => (
          <button key={t} onClick={() => setWType(t)}
            style={{ padding: "6px 12px", borderRadius: "8px", border: `1px solid ${wType === t ? accent : palette.borderColor}`, background: wType === t ? accent : palette.cardBg2, color: wType === t ? "#fff" : palette.textSecondary, fontSize: "13px", cursor: "pointer" }}>
            {t}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
        <input
          type="number"
          placeholder="Minutes"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          min="1"
          style={{ flex: 1, background: palette.inputBg, border: `1px solid ${palette.borderColor}`, borderRadius: "8px", padding: "7px 10px", color: "#e8f5e8", fontSize: "13px", outline: "none" }}
        />
        <div style={{ display: "flex", gap: "4px" }}>
          {intensities.map((i) => (
            <button key={i} onClick={() => setIntensity(i)}
              style={{ padding: "7px 10px", borderRadius: "8px", border: `1px solid ${intensity === i ? accent : palette.borderColor}`, background: intensity === i ? `${accent}22` : "transparent", color: intensity === i ? accent : palette.textSecondary, fontSize: "12px", cursor: "pointer" }}>
              {i}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={doLog}
        disabled={!canLog || logging}
        style={{ background: canLog && !logging ? accent : palette.accentFaint, color: canLog && !logging ? "#fff" : palette.accentDim, border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", cursor: canLog && !logging ? "pointer" : "not-allowed", fontWeight: 600 }}>
        Log workout
      </button>
      {todayEntries.length > 0 && (
        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {todayEntries.slice(-3).map((e, i) => {
            const p = parseSafe(e.value);
            return (
              <p key={i} style={{ fontSize: "12px", color: palette.textSecondary, margin: 0, paddingLeft: "8px", borderLeft: `2px solid ${palette.borderColor}` }}>
                {String(p.type ?? "?")} · {String(p.durationMin ?? "?")}min · {String(p.intensity ?? "")}
                <span style={{ color: palette.accentDim, marginLeft: "6px" }}>{fmtTime(e.loggedAt)}</span>
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Nutrition types ────────────────────────────────────────────────

interface NutritionEntry {
  person: string;
  description: string;
  meal?: string;
  identifiedFoods?: string[];
  estimatedCalories?: number;
  macros?: { protein: number; carbs: number; fat: number };
  notes?: string;
  loggedAt: string;
}

// ── Shared nutrition log form (used by both food_log and calories) ──

function NutritionLogForm({
  person,
  accent,
  onLogged,
}: {
  person: string;
  accent: string;
  onLogged: (entry: NutritionEntry) => void;
}) {
  const palette = tintPalette(accent);
  const MEAL_SLOTS = ["🌅 Breakfast", "☀️ Lunch", "🌙 Dinner", "🍎 Snack"];
  const [meal, setMeal] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastResult, setLastResult] = useState<NutritionEntry | null>(null);

  // Editable estimate fields (shown after AI analysis)
  const [estimate, setEstimate] = useState<{
    description: string;
    meal: string;
    identifiedFoods: string[];
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null>(null);

  const canAnalyse = description.trim().length > 0;

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setPhoto(file);
    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
    } else {
      setPhotoPreview(null);
    }
  };

  const handleAnalyse = async () => {
    if (!canAnalyse) return;
    const effectiveMeal = meal || "🍎 Snack";
    if (!meal) setMeal(effectiveMeal);
    setAnalysing(true);
    setLastResult(null);
    setEstimate(null);
    try {
      const fd = new FormData();
      fd.append("person", person);
      fd.append("description", description.trim());
      fd.append("meal", effectiveMeal);
      fd.append("analyse_only", "true");
      if (photo) fd.append("photo", photo);

      const res = await fetch("/api/personal/nutrition", { method: "POST", body: fd });
      if (res.ok) {
        const entry: NutritionEntry = await res.json();
        setEstimate({
          description: entry.description,
          meal: entry.meal || meal,
          identifiedFoods: entry.identifiedFoods || [],
          calories: entry.estimatedCalories || 0,
          protein: entry.macros?.protein || 0,
          carbs: entry.macros?.carbs || 0,
          fat: entry.macros?.fat || 0,
        });
      } else {
        console.error("Nutrition analyse failed:", await res.text());
      }
    } catch (err) {
      console.error("Nutrition analyse error:", err);
    }
    setAnalysing(false);
  };

  const handleConfirmLog = async () => {
    if (!estimate) return;
    setSaving(true);
    try {
      const res = await fetch("/api/personal/nutrition", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person,
          description: estimate.description,
          meal: estimate.meal,
          identifiedFoods: estimate.identifiedFoods,
          estimatedCalories: estimate.calories,
          macros: { protein: estimate.protein, carbs: estimate.carbs, fat: estimate.fat },
        }),
      });
      if (res.ok) {
        const entry: NutritionEntry = await res.json();
        setLastResult(entry);
        onLogged(entry);
        setEstimate(null);
        setDescription("");
        setMeal("");
        setPhoto(null);
        setPhotoPreview(null);
      } else {
        console.error("Nutrition save failed:", await res.text());
      }
    } catch (err) {
      console.error("Nutrition save error:", err);
    }
    setSaving(false);
  };

  const inputStyle = { width: "100%", background: palette.inputBg, border: `1px solid ${palette.borderColor}`, borderRadius: "8px", padding: "7px 10px", color: "#e8f5e8", fontSize: "13px", outline: "none", boxSizing: "border-box" as const };
  const smallInputStyle = { ...inputStyle, width: "auto", flex: 1, textAlign: "center" as const };

  return (
    <div>
      {/* Editable estimate panel (shown after AI analysis) */}
      {estimate ? (
        <div style={{ background: palette.cardBg, borderRadius: "10px", padding: "12px", border: `1px solid ${accent}44`, marginBottom: "8px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: accent, marginBottom: "8px" }}>Review & edit estimate</div>

          {/* Editable description */}
          <input
            value={estimate.description}
            onChange={(e) => setEstimate({ ...estimate, description: e.target.value })}
            style={{ ...inputStyle, marginBottom: "8px" }}
            placeholder="Meal description"
          />

          {/* Identified foods */}
          {estimate.identifiedFoods.length > 0 && (
            <div style={{ fontSize: "12px", color: palette.textSecondary, marginBottom: "8px" }}>
              🍽️ {estimate.identifiedFoods.join(", ")}
            </div>
          )}

          {/* Editable calorie + macro fields */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 100%" }}>
              <label style={{ fontSize: "11px", color: palette.accentDim, display: "block", marginBottom: "2px" }}>Calories (kcal)</label>
              <input
                type="number"
                value={estimate.calories}
                onChange={(e) => setEstimate({ ...estimate, calories: parseInt(e.target.value) || 0 })}
                style={smallInputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "11px", color: "#3498db", display: "block", marginBottom: "2px" }}>Protein (g)</label>
              <input
                type="number"
                value={estimate.protein}
                onChange={(e) => setEstimate({ ...estimate, protein: parseInt(e.target.value) || 0 })}
                style={smallInputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "11px", color: "#f39c12", display: "block", marginBottom: "2px" }}>Carbs (g)</label>
              <input
                type="number"
                value={estimate.carbs}
                onChange={(e) => setEstimate({ ...estimate, carbs: parseInt(e.target.value) || 0 })}
                style={smallInputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "11px", color: "#9b59b6", display: "block", marginBottom: "2px" }}>Fat (g)</label>
              <input
                type="number"
                value={estimate.fat}
                onChange={(e) => setEstimate({ ...estimate, fat: parseInt(e.target.value) || 0 })}
                style={smallInputStyle}
              />
            </div>
          </div>

          {/* Confirm / Cancel buttons */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleConfirmLog}
              disabled={saving}
              style={{ flex: 1, background: !saving ? accent : palette.accentFaint, color: !saving ? "#fff" : palette.accentDim, border: "none", borderRadius: "8px", padding: "8px 14px", fontSize: "13px", cursor: !saving ? "pointer" : "not-allowed", fontWeight: 600 }}>
              {saving ? "Saving..." : "Log Meal"}
            </button>
            <button
              onClick={() => setEstimate(null)}
              style={{ padding: "8px 14px", borderRadius: "8px", border: `1px solid ${palette.borderColor}`, background: "transparent", color: palette.textSecondary, fontSize: "13px", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Meal slot pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
            {MEAL_SLOTS.map((m) => (
              <button key={m} onClick={() => setMeal(m)}
                style={{ padding: "6px 12px", borderRadius: "8px", border: `1px solid ${meal === m ? accent : palette.borderColor}`, background: meal === m ? accent : palette.cardBg2, color: meal === m ? "#fff" : palette.textSecondary, fontSize: "13px", cursor: "pointer", fontWeight: meal === m ? 600 : 400 }}>
                {m}
              </button>
            ))}
          </div>

          {/* Description input */}
          <input
            placeholder="What did you eat? (e.g. large bowl of oats with banana)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && canAnalyse && !analysing) handleAnalyse(); }}
            style={{ ...inputStyle, marginBottom: "8px" }}
          />

          {/* Photo + submit row */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
            <label style={{ padding: "7px 12px", borderRadius: "8px", border: `1px solid ${palette.borderColor}`, background: palette.cardBg2, color: palette.textSecondary, fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}>
              📷 Add photo
              <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
            </label>
            {photoPreview && (
              <div style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="preview" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: "8px", border: `1px solid ${palette.borderColor}` }} />
                <button onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                  style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#c0392b", border: "none", color: "#fff", fontSize: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  ✕
                </button>
              </div>
            )}
            <button
              onClick={handleAnalyse}
              disabled={!canAnalyse || analysing}
              style={{ flex: 1, background: canAnalyse && !analysing ? accent : palette.accentFaint, color: canAnalyse && !analysing ? "#fff" : palette.accentDim, border: "none", borderRadius: "8px", padding: "8px 14px", fontSize: "13px", cursor: canAnalyse && !analysing ? "pointer" : "not-allowed", fontWeight: 600 }}>
              {analysing ? "🔍 Analysing..." : "Analyse"}
            </button>
          </div>
        </>
      )}

      {/* Last result card */}
      {lastResult && (
        <div style={{ background: palette.cardBg, borderRadius: "10px", padding: "10px 12px", border: `1px solid ${accent}44`, marginBottom: "4px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: accent, marginBottom: "4px" }}>Logged!</div>
          {lastResult.identifiedFoods && lastResult.identifiedFoods.length > 0 && (
            <div style={{ fontSize: "12px", color: palette.textSecondary, marginBottom: "4px" }}>
              🍽️ {lastResult.identifiedFoods.join(", ")}
            </div>
          )}
          {lastResult.estimatedCalories ? (
            <div style={{ fontSize: "13px", color: "#e8f5e8" }}>
              ~{lastResult.estimatedCalories} kcal
              {lastResult.macros && (
                <span style={{ color: palette.textSecondary, fontSize: "12px" }}>
                  {" "}· P {lastResult.macros.protein}g · C {lastResult.macros.carbs}g · F {lastResult.macros.fat}g
                </span>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── NutritionTracker — full calorie+macro tracker (used by both calories and food_log) ──

function NutritionTracker({
  person,
  accent,
  calorieGoal,
  proteinGoal,
  carbsGoal,
  fatGoal,
}: {
  person: string;
  accent: string;
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
}) {
  const palette = tintPalette(accent);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Brisbane" });
  const [nutritionEntries, setNutritionEntries] = useState<NutritionEntry[]>([]);

  const fetchNutrition = useCallback(async () => {
    try {
      const res = await fetch(`/api/personal/nutrition?person=${encodeURIComponent(person)}&date=${today}`);
      if (res.ok) {
        const data = await res.json();
        setNutritionEntries(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("[NutritionTracker] fetchNutrition error:", err);
    }
  }, [person, today]);

  useEffect(() => { fetchNutrition(); }, [fetchNutrition]);

  const handleLogged = (entry: NutritionEntry) => {
    setNutritionEntries((prev) => [...prev, entry]);
  };

  const totalKcal = nutritionEntries.reduce((s, e) => s + (e.estimatedCalories || 0), 0);
  const totalP = nutritionEntries.reduce((s, e) => s + (e.macros?.protein || 0), 0);
  const totalC = nutritionEntries.reduce((s, e) => s + (e.macros?.carbs || 0), 0);
  const totalF = nutritionEntries.reduce((s, e) => s + (e.macros?.fat || 0), 0);

  const kcalPct = Math.min(100, Math.round((totalKcal / calorieGoal) * 100));

  // Group by meal slot for compact list
  const SLOT_ORDER = ["🌅 Breakfast", "☀️ Lunch", "🌙 Dinner", "🍎 Snack"];
  const byMeal: Record<string, NutritionEntry[]> = {};
  for (const e of nutritionEntries) {
    const slot = e.meal || "Other";
    if (!byMeal[slot]) byMeal[slot] = [];
    byMeal[slot].push(e);
  }
  const slots = [...SLOT_ORDER.filter((s) => byMeal[s]), ...Object.keys(byMeal).filter((s) => !SLOT_ORDER.includes(s))];

  const MacroBar = ({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) => {
    const pct = Math.min(100, Math.round((value / goal) * 100));
    return (
      <div style={{ marginBottom: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "3px" }}>
          <span style={{ color: palette.textSecondary }}>{label}</span>
          <span style={{ color: "#e8f5e8" }}>{value}g <span style={{ color: palette.accentDim }}>/ {goal}g</span></span>
        </div>
        <div style={{ height: "6px", borderRadius: "3px", background: palette.trackBg, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "3px", transition: "width 0.5s" }} />
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Calorie ring / progress */}
      <div style={{ marginBottom: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
          <span style={{ fontSize: "22px", fontWeight: 700, color: kcalPct >= 100 ? "#e74c3c" : accent }}>{totalKcal.toLocaleString()}</span>
          <span style={{ fontSize: "13px", color: palette.accentDim }}>/ {calorieGoal.toLocaleString()} kcal</span>
        </div>
        <div style={{ height: "10px", borderRadius: "5px", background: palette.trackBg, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${kcalPct}%`, background: kcalPct >= 100 ? "#e74c3c" : accent, borderRadius: "5px", transition: "width 0.5s" }} />
        </div>
        <div style={{ fontSize: "11px", color: palette.accentDim, marginTop: "2px", textAlign: "right" }}>{kcalPct}%</div>
      </div>

      {/* Macro bars */}
      <MacroBar label="Protein" value={totalP} goal={proteinGoal} color="#3498db" />
      <MacroBar label="Carbs" value={totalC} goal={carbsGoal} color="#f39c12" />
      <MacroBar label="Fat" value={totalF} goal={fatGoal} color="#9b59b6" />

      {/* Log form */}
      <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: `1px solid ${palette.borderColor}` }}>
        <NutritionLogForm person={person} accent={accent} onLogged={handleLogged} />
      </div>

      {/* Compact meals list */}
      {slots.length > 0 && (
        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {slots.map((slot) => (
            <div key={slot}>
              <div style={{ fontSize: "11px", color: accent, fontWeight: 600, marginBottom: "2px" }}>{slot}</div>
              {byMeal[slot].map((e, i) => (
                <div key={i} style={{ fontSize: "12px", color: palette.textSecondary, paddingLeft: "8px", marginBottom: "2px" }}>
                  {e.description}
                  {e.estimatedCalories ? <span style={{ color: palette.accentDim }}> · {e.estimatedCalories} kcal</span> : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WaterTracker({
  todayEntries, logValue, logging, accent, goal,
}: { todayEntries: LogEntry[]; logValue: (v: unknown) => void; logging: boolean; accent: string; goal: number }) {
  const palette = tintPalette(accent);
  const [custom, setCustom] = useState("");
  const quickOpts = [150, 250, 350, 500].map((ml) => ({ label: `+${ml}ml`, value: ml }));

  const todayTotal = todayEntries.reduce((sum, e) => sum + (typeof e.value === "number" ? e.value : 0), 0);

  const doLog = (val: number) => { logValue(val); setCustom(""); };

  return (
    <div>
      <div style={{ fontSize: "20px", fontWeight: 700, color: accent, marginBottom: "4px" }}>
        {todayTotal.toLocaleString()}ml
        <span style={{ fontSize: "13px", color: palette.accentDim, fontWeight: 400, marginLeft: "6px" }}>/ {goal.toLocaleString()}ml</span>
      </div>
      <ProgressBar value={todayTotal} goal={goal} accent={accent} />
      <QuickPills options={quickOpts} onSelect={doLog} accent={accent} />
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="number"
          placeholder="Custom ml"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          min="1"
          style={{ flex: 1, background: palette.inputBg, border: `1px solid ${palette.borderColor}`, borderRadius: "8px", padding: "7px 10px", color: "#e8f5e8", fontSize: "13px", outline: "none" }}
        />
        {custom && (
          <button onClick={() => { const v = parseInt(custom); if (!isNaN(v)) doLog(v); }} disabled={logging}
            style={{ background: accent, color: "#fff", border: "none", borderRadius: "8px", padding: "7px 14px", fontSize: "13px", cursor: "pointer", fontWeight: 600 }}>
            Add
          </button>
        )}
      </div>
    </div>
  );
}

function StepsTracker({
  todayEntries, logValue, logging, accent, goal,
}: { todayEntries: LogEntry[]; logValue: (v: unknown) => void; logging: boolean; accent: string; goal: number }) {
  const palette = tintPalette(accent);
  const [input, setInput] = useState("");
  const quickOpts = [1000, 2500, 5000].map((s) => ({ label: `+${s.toLocaleString()}`, value: s }));

  const todayTotal = todayEntries.reduce((sum, e) => sum + (typeof e.value === "number" ? e.value : 0), 0);

  const doLog = (val: number) => { logValue(val); setInput(""); };

  return (
    <div>
      <div style={{ fontSize: "20px", fontWeight: 700, color: accent, marginBottom: "4px" }}>
        {todayTotal.toLocaleString()}
        <span style={{ fontSize: "13px", color: palette.accentDim, fontWeight: 400, marginLeft: "6px" }}>/ {goal.toLocaleString()} steps</span>
      </div>
      <ProgressBar value={todayTotal} goal={goal} accent={accent} />
      <QuickPills options={quickOpts} onSelect={doLog} accent={accent} />
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="number"
          placeholder="Log steps"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          min="1"
          style={{ flex: 1, background: palette.inputBg, border: `1px solid ${palette.borderColor}`, borderRadius: "8px", padding: "7px 10px", color: "#e8f5e8", fontSize: "13px", outline: "none" }}
        />
        {input && (
          <button onClick={() => { const v = parseInt(input); if (!isNaN(v)) doLog(v); }} disabled={logging}
            style={{ background: accent, color: "#fff", border: "none", borderRadius: "8px", padding: "7px 14px", fontSize: "13px", cursor: "pointer", fontWeight: 600 }}>
            Log
          </button>
        )}
      </div>
    </div>
  );
}

function MotivationBot({ accent }: { accent: string }) {
  const palette = tintPalette(accent);
  const [blip, setBlip] = useState<{ blip: string; generatedAt: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/personal/blip");
      if (res.ok) {
        const d = await res.json();
        if (d.blip) {
          setBlip({ blip: d.blip, generatedAt: d.generatedAt });
        } else {
          setError(true);
        }
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  return (
    <div>
      {loading ? (
        <div style={{ background: palette.cardBg, borderRadius: "10px", padding: "14px 16px", border: `1px solid ${palette.borderColor}` }}>
          <div style={{ height: "14px", borderRadius: "6px", background: "rgba(168,200,168,0.15)", marginBottom: "8px" }} />
          <div style={{ height: "14px", borderRadius: "6px", background: "rgba(168,200,168,0.10)", width: "70%" }} />
        </div>
      ) : blip ? (
        <div style={{ background: palette.cardBg, borderRadius: "12px", padding: "14px 16px", border: `1px solid ${accent}33` }}>
          <div style={{ fontSize: "20px", marginBottom: "8px" }}>✨</div>
          <p style={{ margin: "0 0 10px", color: "#e8f5e8", fontStyle: "italic", fontSize: "14px", lineHeight: 1.6 }}>
            &ldquo;{blip.blip}&rdquo;
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: palette.accentDim }}>Updated {fmtAgo(blip.generatedAt)}</span>
            <button
              onClick={fetch_}
              style={{ background: "none", border: `1px solid ${palette.borderColor}`, borderRadius: "6px", color: palette.accentDim, cursor: "pointer", fontSize: "12px", padding: "3px 8px" }}>
              ↻ New tip
            </button>
          </div>
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "12px" }}>
          <p style={{ fontSize: "13px", color: palette.accentDim, margin: "0 0 8px" }}>Couldn&apos;t load tip</p>
          <button onClick={fetch_} style={{ background: accent, color: "#fff", border: "none", borderRadius: "8px", padding: "7px 14px", fontSize: "13px", cursor: "pointer" }}>Try again</button>
        </div>
      ) : (
        <button onClick={fetch_} style={{ background: accent, color: "#fff", border: "none", borderRadius: "8px", padding: "7px 14px", fontSize: "13px", cursor: "pointer" }}>Load tip</button>
      )}
    </div>
  );
}

// ── Journal / text subtypes ────────────────────────────────────────

const PROMPTS: Record<string, string[]> = {
  journal: [
    "What's on your mind today?",
    "What's one thing you're proud of lately?",
    "What are you looking forward to?",
    "What challenged you today, and what did you learn?",
    "Describe your mood in 3 words.",
  ],
  manifestation: [
    "Write as if your dream life is already happening…",
    "I am becoming someone who…",
    "Today I attract…",
    "The future I'm creating looks like…",
    "What does my best life feel like?",
  ],
  reflection: [
    "What am I grateful to God/the universe for today?",
    "Where did I feel peace today?",
    "What prayer or intention is on my heart right now?",
    "How did I serve others today?",
    "What truth do I need to hold onto today?",
  ],
  purpose: [
    "What truly matters to me?",
    "When do I feel most alive?",
    "What legacy do I want to leave?",
    "What would I do if I knew I couldn't fail?",
    "Who do I want to become?",
  ],
};

function getDailyPrompt(subtype: string): string {
  const pool = PROMPTS[subtype] ?? ["Write anything…"];
  const idx = Math.floor(Date.now() / 86400000) % pool.length;
  return pool[idx];
}

function JournalEntry({
  todayEntries, logValue, logging, accent, subtype,
}: { todayEntries: LogEntry[]; logValue: (v: unknown) => void; logging: boolean; accent: string; subtype: string }) {
  const palette = tintPalette(accent);
  const [text, setText] = useState("");
  const prompt = getDailyPrompt(subtype);

  return (
    <div>
      <p style={{ fontSize: "12px", color: palette.accentDim, margin: "0 0 6px", fontStyle: "italic" }}>✍️ {prompt}</p>
      <textarea
        placeholder="Write here…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        style={{ width: "100%", background: palette.inputBg, border: `1px solid ${palette.borderColor}`, borderRadius: "8px", padding: "8px 10px", color: "#e8f5e8", fontSize: "13px", resize: "none", outline: "none", boxSizing: "border-box", marginBottom: "8px" }}
      />
      <button
        onClick={() => { if (text.trim()) { logValue(text.trim()); setText(""); } }}
        disabled={!text.trim() || logging}
        style={{ background: text.trim() && !logging ? accent : palette.accentFaint, color: text.trim() && !logging ? "#fff" : palette.accentDim, border: "none", borderRadius: "8px", padding: "7px 16px", fontSize: "13px", cursor: text.trim() && !logging ? "pointer" : "not-allowed", fontWeight: 600 }}>
        Save
      </button>
      {todayEntries.length > 0 && (
        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {todayEntries.slice(-3).map((e, i) => (
            <p key={i} style={{ fontSize: "12px", color: palette.textSecondary, margin: 0, paddingLeft: "8px", borderLeft: `2px solid ${palette.borderColor}`, lineHeight: 1.4 }}>
              {String(e.value).slice(0, 120)}{String(e.value).length > 120 ? "…" : ""}
              <span style={{ color: palette.accentDim, marginLeft: "6px" }}>{fmtTime(e.loggedAt)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function GratitudeLogger({
  todayEntries, logValue, logging, accent,
}: { todayEntries: LogEntry[]; logValue: (v: unknown) => void; logging: boolean; accent: string }) {
  const palette = tintPalette(accent);
  const [g1, setG1] = useState("");
  const [g2, setG2] = useState("");
  const [g3, setG3] = useState("");

  const canLog = g1.trim() || g2.trim() || g3.trim();
  const doLog = () => {
    const items = [g1, g2, g3].map((s) => s.trim()).filter(Boolean);
    if (!items.length) return;
    logValue(JSON.stringify({ gratitudes: items }));
    setG1(""); setG2(""); setG3("");
  };

  const placeholder = (n: number) => `I'm grateful for… (${n})`;

  return (
    <div>
      {[{ v: g1, set: setG1, n: 1 }, { v: g2, set: setG2, n: 2 }, { v: g3, set: setG3, n: 3 }].map(({ v, set, n }) => (
        <input
          key={n}
          placeholder={placeholder(n)}
          value={v}
          onChange={(e) => set(e.target.value)}
          style={{ width: "100%", background: palette.inputBg, border: `1px solid ${palette.borderColor}`, borderRadius: "8px", padding: "7px 10px", color: "#e8f5e8", fontSize: "13px", outline: "none", boxSizing: "border-box", marginBottom: "6px" }}
        />
      ))}
      <button
        onClick={doLog}
        disabled={!canLog || logging}
        style={{ background: canLog && !logging ? accent : palette.accentFaint, color: canLog && !logging ? "#fff" : palette.accentDim, border: "none", borderRadius: "8px", padding: "7px 16px", fontSize: "13px", cursor: canLog && !logging ? "pointer" : "not-allowed", fontWeight: 600 }}>
        Log gratitude
      </button>
      {todayEntries.length > 0 && (
        <div style={{ marginTop: "8px" }}>
          {todayEntries.slice(-1).map((e, i) => {
            const p = parseSafe(e.value);
            const items = Array.isArray(p.gratitudes) ? (p.gratitudes as string[]) : [];
            return (
              <div key={i} style={{ fontSize: "12px", color: palette.textSecondary, paddingLeft: "8px", borderLeft: `2px solid ${palette.borderColor}` }}>
                {items.map((t, j) => <p key={j} style={{ margin: "2px 0" }}>🙏 {t}</p>)}
                <span style={{ color: palette.accentDim }}>{fmtTime(e.loggedAt)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IntentionsCard({
  todayEntries, logValue, logging, accent,
}: { todayEntries: LogEntry[]; logValue: (v: unknown) => void; logging: boolean; accent: string }) {
  const palette = tintPalette(accent);
  const [text, setText] = useState("");
  const existing = todayEntries[todayEntries.length - 1];

  if (existing) {
    return (
      <div>
        <p style={{ fontSize: "13px", color: palette.textSecondary, margin: "0 0 6px" }}>Today&apos;s intention:</p>
        <p style={{ fontSize: "14px", color: "#e8f5e8", fontStyle: "italic", margin: "0 0 8px", paddingLeft: "8px", borderLeft: `2px solid ${accent}` }}>
          &ldquo;{String(existing.value)}&rdquo;
        </p>
        <span style={{ fontSize: "12px", color: palette.accentDim }}>Set at {fmtTime(existing.loggedAt)}</span>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: "12px", color: palette.accentDim, margin: "0 0 6px", fontStyle: "italic" }}>Today I intend to…</p>
      <input
        placeholder="Set your intention for today"
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ width: "100%", background: palette.inputBg, border: `1px solid ${palette.borderColor}`, borderRadius: "8px", padding: "7px 10px", color: "#e8f5e8", fontSize: "13px", outline: "none", boxSizing: "border-box", marginBottom: "8px" }}
      />
      <button
        onClick={() => { if (text.trim()) { logValue(text.trim()); setText(""); } }}
        disabled={!text.trim() || logging}
        style={{ background: text.trim() && !logging ? accent : palette.accentFaint, color: text.trim() && !logging ? "#fff" : palette.accentDim, border: "none", borderRadius: "8px", padding: "7px 16px", fontSize: "13px", cursor: text.trim() && !logging ? "pointer" : "not-allowed", fontWeight: 600 }}>
        Set intention
      </button>
    </div>
  );
}

function TimerTracker({
  todayEntries, logValue, logging, accent, goal, quickOptions, unit,
}: { todayEntries: LogEntry[]; logValue: (v: unknown) => void; logging: boolean; accent: string; goal: number; quickOptions: number[]; unit: string }) {
  const palette = tintPalette(accent);
  const [custom, setCustom] = useState("");
  const [selected, setSelected] = useState<number | undefined>();

  const todayTotal = todayEntries.reduce((sum, e) => sum + (typeof e.value === "number" ? e.value : 0), 0);
  const quickOpts = quickOptions.map((v) => ({ label: `${v}m`, value: v }));

  const doLog = (val: number) => { setSelected(val); logValue(val); setCustom(""); };

  return (
    <div>
      <div style={{ fontSize: "18px", fontWeight: 700, color: accent, marginBottom: "4px" }}>
        {todayTotal} {unit}
        <span style={{ fontSize: "13px", color: palette.accentDim, fontWeight: 400, marginLeft: "6px" }}>/ {goal} {unit} goal</span>
      </div>
      <ProgressBar value={todayTotal} goal={goal} accent={accent} />
      <QuickPills options={quickOpts} onSelect={doLog} accent={accent} selected={selected} />
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="number"
          placeholder={`Custom ${unit}`}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          min="1"
          style={{ flex: 1, background: palette.inputBg, border: `1px solid ${palette.borderColor}`, borderRadius: "8px", padding: "7px 10px", color: "#e8f5e8", fontSize: "13px", outline: "none" }}
        />
        {custom && (
          <button onClick={() => { const v = parseInt(custom); if (!isNaN(v)) doLog(v); }} disabled={logging}
            style={{ background: accent, color: "#fff", border: "none", borderRadius: "8px", padding: "7px 14px", fontSize: "13px", cursor: "pointer", fontWeight: 600 }}>
            Log
          </button>
        )}
      </div>
    </div>
  );
}

function MindfulnessCheckin({
  todayEntries, logValue, logging, accent,
}: { todayEntries: LogEntry[]; logValue: (v: unknown) => void; logging: boolean; accent: string }) {
  const palette = tintPalette(accent);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);

  const lastEntry = todayEntries[todayEntries.length - 1];
  const lastParsed = lastEntry ? parseSafe(lastEntry.value) : null;

  const doLog = (checked: boolean) => {
    logValue(JSON.stringify({ checked, note: note.trim() || undefined }));
    setDone(checked);
    setNote("");
  };

  if (lastParsed?.checked) {
    const noteStr: string | null = lastParsed.note ? String(lastParsed.note) : null;
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <span style={{ fontSize: "20px" }}>✅</span>
          <span style={{ color: accent, fontWeight: 600, fontSize: "14px" }}>Done for today</span>
        </div>
        {noteStr && <p style={{ fontSize: "12px", color: palette.textSecondary, margin: "0 0 4px", fontStyle: "italic" }}>&ldquo;{noteStr}&rdquo;</p>}
        <span style={{ fontSize: "12px", color: palette.accentDim }}>{fmtTime(lastEntry.loggedAt)}</span>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: "13px", color: palette.textSecondary, margin: "0 0 10px" }}>Did you pause and notice the present moment?</p>
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
        <button
          onClick={() => doLog(true)}
          disabled={logging || done}
          style={{ flex: 1, padding: "10px", borderRadius: "10px", border: `2px solid ${accent}`, background: `${accent}22`, color: accent, fontWeight: 600, cursor: "pointer", fontSize: "14px" }}>
          ✓ Yes
        </button>
        <button
          onClick={() => doLog(false)}
          disabled={logging}
          style={{ flex: 1, padding: "10px", borderRadius: "10px", border: `2px solid ${palette.borderColor}`, background: "transparent", color: palette.textSecondary, cursor: "pointer", fontSize: "14px" }}>
          Not yet
        </button>
      </div>
      <input
        placeholder="What did you notice? (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={{ width: "100%", background: palette.inputBg, border: `1px solid ${palette.borderColor}`, borderRadius: "8px", padding: "7px 10px", color: "#e8f5e8", fontSize: "13px", outline: "none", boxSizing: "border-box" }}
      />
    </div>
  );
}

function ReadingLogger({
  todayEntries, logValue, logging, accent,
}: { todayEntries: LogEntry[]; logValue: (v: unknown) => void; logging: boolean; accent: string }) {
  const palette = tintPalette(accent);
  const [book, setBook] = useState("");
  const [amount, setAmount] = useState("");
  const [amtType, setAmtType] = useState<"pages" | "minutes">("pages");

  const canLog = book.trim() && amount;
  const doLog = () => {
    if (!canLog) return;
    logValue(JSON.stringify({ book: book.trim(), [amtType]: parseInt(amount) }));
    setAmount("");
  };

  return (
    <div>
      <input
        placeholder="Book title"
        value={book}
        onChange={(e) => setBook(e.target.value)}
        style={{ width: "100%", background: palette.inputBg, border: `1px solid ${palette.borderColor}`, borderRadius: "8px", padding: "7px 10px", color: "#e8f5e8", fontSize: "13px", outline: "none", boxSizing: "border-box", marginBottom: "6px" }}
      />
      <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
        <input
          type="number"
          placeholder={amtType === "pages" ? "Pages" : "Minutes"}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="1"
          style={{ flex: 1, background: palette.inputBg, border: `1px solid ${palette.borderColor}`, borderRadius: "8px", padding: "7px 10px", color: "#e8f5e8", fontSize: "13px", outline: "none" }}
        />
        <button onClick={() => setAmtType("pages")}
          style={{ padding: "7px 10px", borderRadius: "8px", border: `1px solid ${amtType === "pages" ? accent : palette.borderColor}`, background: amtType === "pages" ? `${accent}22` : "transparent", color: amtType === "pages" ? accent : palette.textSecondary, fontSize: "12px", cursor: "pointer" }}>
          Pages
        </button>
        <button onClick={() => setAmtType("minutes")}
          style={{ padding: "7px 10px", borderRadius: "8px", border: `1px solid ${amtType === "minutes" ? accent : palette.borderColor}`, background: amtType === "minutes" ? `${accent}22` : "transparent", color: amtType === "minutes" ? accent : palette.textSecondary, fontSize: "12px", cursor: "pointer" }}>
          Min
        </button>
      </div>
      <button
        onClick={doLog}
        disabled={!canLog || logging}
        style={{ background: canLog && !logging ? accent : palette.accentFaint, color: canLog && !logging ? "#fff" : palette.accentDim, border: "none", borderRadius: "8px", padding: "7px 16px", fontSize: "13px", cursor: canLog && !logging ? "pointer" : "not-allowed", fontWeight: 600 }}>
        Log reading
      </button>
      {todayEntries.length > 0 && (
        <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {todayEntries.slice(-3).map((e, i) => {
            const p = parseSafe(e.value);
            const amt = p.pages ? `${p.pages}p` : p.minutes ? `${p.minutes}m` : "?";
            return (
              <p key={i} style={{ fontSize: "12px", color: palette.textSecondary, margin: 0, paddingLeft: "8px", borderLeft: `2px solid ${palette.borderColor}` }}>
                📚 {String(p.book ?? "?")} · {amt}
                <span style={{ color: palette.accentDim, marginLeft: "6px" }}>{fmtTime(e.loggedAt)}</span>
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConnectionLogger({
  todayEntries, logValue, logging, accent,
}: { todayEntries: LogEntry[]; logValue: (v: unknown) => void; logging: boolean; accent: string }) {
  const palette = tintPalette(accent);
  const [who, setWho] = useState("");
  const [what, setWhat] = useState("");

  const canLog = who.trim() && what.trim();
  const doLog = () => {
    if (!canLog) return;
    logValue(JSON.stringify({ who: who.trim(), what: what.trim() }));
    setWho(""); setWhat("");
  };

  return (
    <div>
      <input
        placeholder="Who? (e.g. Mum, Partner, Friend)"
        value={who}
        onChange={(e) => setWho(e.target.value)}
        style={{ width: "100%", background: palette.inputBg, border: `1px solid ${palette.borderColor}`, borderRadius: "8px", padding: "7px 10px", color: "#e8f5e8", fontSize: "13px", outline: "none", boxSizing: "border-box", marginBottom: "6px" }}
      />
      <input
        placeholder="What? (e.g. Coffee, Long chat, Played together)"
        value={what}
        onChange={(e) => setWhat(e.target.value)}
        style={{ width: "100%", background: palette.inputBg, border: `1px solid ${palette.borderColor}`, borderRadius: "8px", padding: "7px 10px", color: "#e8f5e8", fontSize: "13px", outline: "none", boxSizing: "border-box", marginBottom: "8px" }}
      />
      <button
        onClick={doLog}
        disabled={!canLog || logging}
        style={{ background: canLog && !logging ? accent : palette.accentFaint, color: canLog && !logging ? "#fff" : palette.accentDim, border: "none", borderRadius: "8px", padding: "7px 16px", fontSize: "13px", cursor: canLog && !logging ? "pointer" : "not-allowed", fontWeight: 600 }}>
        Log connection
      </button>
      {todayEntries.length > 0 && (
        <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {todayEntries.slice(-3).map((e, i) => {
            const p = parseSafe(e.value);
            return (
              <p key={i} style={{ fontSize: "12px", color: palette.textSecondary, margin: 0, paddingLeft: "8px", borderLeft: `2px solid ${palette.borderColor}` }}>
                💛 {String(p.who ?? "?")} · {String(p.what ?? "?")}
                <span style={{ color: palette.accentDim, marginLeft: "6px" }}>{fmtTime(e.loggedAt)}</span>
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main card ──────────────────────────────────────────────────────

export default function DynamicModuleCard({
  module: mod,
  person,
  onRemoved,
  accentColor,
}: {
  module: ModuleEntry;
  person: string;
  onRemoved: () => void;
  accentColor?: string;
}) {
  const accent = accentColor ?? "#5cb85c";
  const palette = tintPalette(accent);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [logging, setLogging] = useState(false);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Brisbane" });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/personal/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_data", person, id: mod.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error(`[Module ${mod.label}] fetchData error:`, err);
    }
  }, [person, mod.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const logValue = async (value: unknown) => {
    setLogging(true);
    try {
      const res = await fetch("/api/personal/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "log", person, id: mod.id, value }),
      });
      if (res.ok) {
        const data = await res.json();
        setEntries((prev) => [...prev, data.entry]);
        // Refresh from server for consistency
        fetchData();
      } else {
        const errBody = await res.text();
        console.error(`[Module ${mod.label}] log failed (${res.status}):`, errBody);
      }
    } catch (err) {
      console.error(`[Module ${mod.label}] log error:`, err);
    }
    setLogging(false);
  };

  const handleRemove = async () => {
    if (!confirm(`Remove "${mod.label}" module?`)) return;
    try {
      await fetch("/api/personal/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", person, id: mod.id }),
      });
      onRemoved();
    } catch (err) {
      console.error(`[Module ${mod.label}] remove error:`, err);
    }
  };

  const todayEntries = entries.filter((e) => {
    const entryDate = new Date(e.loggedAt).toLocaleDateString("en-CA", { timeZone: "Australia/Brisbane" });
    return entryDate === today;
  });
  const todayCount = todayEntries.reduce((sum, e) => sum + (typeof e.value === "number" ? e.value : 1), 0);
  const goal = mod.goal ?? 0;

  // ── Subtype dispatch ─────────────────────────────────────────────
  const renderBody = () => {
    switch (mod.subtype) {
      case "mood_scale":
        return <MoodScale todayEntries={todayEntries} logValue={logValue} logging={logging} accent={accent} />;

      case "sleep":
        return <SleepTracker todayEntries={todayEntries} allEntries={entries} logValue={logValue} logging={logging} accent={accent} goal={goal || 8} />;

      case "workout":
        return <WorkoutLogger todayEntries={todayEntries} logValue={logValue} logging={logging} accent={accent} />;

      case "food_log":
      case "calories": {
        const calorieGoal = mod.goal || 2000;
        const proteinGoal = 150;
        const carbsGoal = 250;
        const fatGoal = 80;
        return <NutritionTracker person={person} accent={accent} calorieGoal={calorieGoal} proteinGoal={proteinGoal} carbsGoal={carbsGoal} fatGoal={fatGoal} />;
      }

      case "water":
        return <WaterTracker todayEntries={todayEntries} logValue={logValue} logging={logging} accent={accent} goal={goal || 2000} />;

      case "steps":
        return <StepsTracker todayEntries={todayEntries} logValue={logValue} logging={logging} accent={accent} goal={goal || 10000} />;

      case "motivation_bot":
        return <MotivationBot accent={accent} />;

      case "journal":
      case "manifestation":
      case "reflection":
      case "purpose":
        return <JournalEntry todayEntries={todayEntries} logValue={logValue} logging={logging} accent={accent} subtype={mod.subtype} />;

      case "gratitude":
        return <GratitudeLogger todayEntries={todayEntries} logValue={logValue} logging={logging} accent={accent} />;

      case "intentions":
        return <IntentionsCard todayEntries={todayEntries} logValue={logValue} logging={logging} accent={accent} />;

      case "meditation":
        return <TimerTracker todayEntries={todayEntries} logValue={logValue} logging={logging} accent={accent} goal={goal || 10} quickOptions={[5, 10, 15, 20, 30]} unit="min" />;

      case "focus":
        return <TimerTracker todayEntries={todayEntries} logValue={logValue} logging={logging} accent={accent} goal={goal || 60} quickOptions={[25, 45, 60, 90]} unit="min" />;

      case "mindfulness_checkin":
        return <MindfulnessCheckin todayEntries={todayEntries} logValue={logValue} logging={logging} accent={accent} />;

      case "reading":
        return <ReadingLogger todayEntries={todayEntries} logValue={logValue} logging={logging} accent={accent} />;

      case "connection":
        return <ConnectionLogger todayEntries={todayEntries} logValue={logValue} logging={logging} accent={accent} />;

      default:
        return null; // fall through to generic below
    }
  };

  const subtypeBody = renderBody();

  return (
    <div
      className="relative rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.3)] p-5"
      style={{ background: palette.cardBg2, border: `1px solid ${palette.borderColor}` }}
    >
      {/* Remove button */}
      <button
        onClick={handleRemove}
        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-md text-xs transition-colors hover:bg-red-500/15 hover:text-red-400"
        style={{ color: palette.accentDim }}
        title="Remove module"
      >
        ✕
      </button>

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span style={{ fontSize: "20px" }}>{mod.emoji}</span>
        <h3 className="text-lg font-semibold" style={{ color: accent }}>
          {mod.label}
        </h3>
      </div>

      {/* Subtype-specific UI */}
      {subtypeBody}

      {/* ── Generic fallbacks (no subtype) ─────────────────────── */}

      {!subtypeBody && mod.type === "counter" && (
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl font-bold" style={{ color: accent }}>{todayCount}</span>
            {mod.unit && <span className="text-sm" style={{ color: palette.textSecondary }}>{mod.unit}</span>}
            {goal > 0 && <span className="text-xs" style={{ color: palette.accentDim }}>/ {goal} goal</span>}
          </div>
          {goal > 0 && <ProgressBar value={todayCount} goal={goal} accent={accent} />}
          <button
            onClick={() => logValue(1)}
            disabled={logging}
            className={`${btnBase} text-sm px-4 py-2`}
            style={logging ? { background: palette.accentFaint, color: palette.accentDim, cursor: "not-allowed" } : { background: accent, color: "#fff" }}
          >
            + 1{mod.unit ? ` ${mod.unit}` : ""}
          </button>
          {todayEntries.length > 0 && (
            <div className="mt-3 pt-2" style={{ borderTop: `1px solid ${palette.borderColor}` }}>
              <p className="text-xs" style={{ color: palette.accentDim }}>
                {todayEntries.length} log{todayEntries.length !== 1 ? "s" : ""} today
                {` · last at ${fmtTime(todayEntries[todayEntries.length - 1].loggedAt)}`}
              </p>
            </div>
          )}
        </div>
      )}

      {!subtypeBody && mod.type === "number_log" && (
        <div>
          {todayEntries.length > 0 && (
            <div className="mb-2">
              <span className="text-sm" style={{ color: palette.textSecondary }}>
                Latest: <strong style={{ color: accent }}>{String(todayEntries[todayEntries.length - 1].value)}</strong>
                {mod.unit && ` ${mod.unit}`}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder={`Enter ${mod.unit || "value"}`}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ background: palette.inputBg, border: `1px solid ${palette.borderColor}`, color: "#e8f5e8" }}
            />
            <button
              onClick={() => { const v = parseFloat(inputVal); if (!isNaN(v)) { logValue(v); setInputVal(""); } }}
              disabled={logging || !inputVal}
              className={`${btnBase} text-xs px-3 py-2`}
              style={logging || !inputVal ? { background: palette.accentFaint, color: palette.accentDim, cursor: "not-allowed" } : { background: accent, color: "#fff" }}
            >
              Log
            </button>
          </div>
        </div>
      )}

      {!subtypeBody && mod.type === "toggle" && (() => {
        const lastToday = todayEntries[todayEntries.length - 1];
        const isOn = lastToday?.value === true;
        return (
          <div className="flex items-center gap-3">
            <button
              onClick={() => logValue(!isOn)}
              disabled={logging}
              className="w-12 h-7 rounded-full transition-all duration-200 relative"
              style={{ background: isOn ? accent : palette.inputBg, border: `1px solid ${palette.borderColor}` }}
            >
              <div className="w-5 h-5 rounded-full transition-all duration-200 absolute top-0.5"
                style={{ background: isOn ? "#fff" : palette.accentDim, left: isOn ? "22px" : "2px" }} />
            </button>
            <span className="text-sm" style={{ color: isOn ? accent : palette.textSecondary }}>
              {isOn ? "Done" : "Not yet"}
            </span>
          </div>
        );
      })()}

      {!subtypeBody && mod.type === "text_note" && (
        <div>
          <textarea
            placeholder="Write a note..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none mb-2"
            style={{ background: palette.inputBg, border: `1px solid ${palette.borderColor}`, color: "#e8f5e8" }}
          />
          <button
            onClick={() => { if (inputVal.trim()) { logValue(inputVal.trim()); setInputVal(""); } }}
            disabled={logging || !inputVal.trim()}
            className={`${btnBase} text-xs px-3 py-2`}
            style={logging || !inputVal.trim() ? { background: palette.accentFaint, color: palette.accentDim, cursor: "not-allowed" } : { background: accent, color: "#fff" }}
          >
            Save
          </button>
          {todayEntries.length > 0 && (
            <div className="mt-2 space-y-1">
              {todayEntries.slice(-3).map((e, i) => (
                <p key={i} className="text-xs pl-2" style={{ color: palette.textSecondary, borderLeft: `2px solid ${palette.borderColor}` }}>
                  {String(e.value)}
                  <span className="ml-2" style={{ color: palette.accentDim }}>{fmtTime(e.loggedAt)}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {!subtypeBody && mod.type === "checklist" && mod.items && (
        <ul className="space-y-2">
          {mod.items.map((item, i) => {
            const checked = todayEntries.some((e) => {
              const val = e.value as { item?: string; checked?: boolean };
              return val?.item === item && val?.checked;
            });
            return (
              <li key={i} className="flex items-center gap-3 text-sm">
                <button
                  onClick={() => logValue({ item, checked: !checked })}
                  disabled={logging}
                  className="w-6 h-6 rounded-md border flex items-center justify-center text-xs flex-shrink-0 transition-colors"
                  style={checked
                    ? { background: `${accent}33`, borderColor: accent, color: accent, cursor: "default" }
                    : { background: palette.inputBg, borderColor: palette.borderColor, color: palette.accentDim, cursor: "pointer" }}
                >
                  {checked ? "✓" : ""}
                </button>
                <span style={checked ? { color: palette.accentDim, textDecoration: "line-through" } : { color: "#e8f5e8" }}>
                  {item}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
