"use client";

import { useState } from "react";

const bg = "#0f1c0f";
const cardBg = "#1a2e1a";
const cardBg2 = "#2d4a2d";
const border = "#3d6b3d";
const textPrimary = "#e8f5e8";
const textSecondary = "#a8c8a8";
const inputBg = "#1f3a1f";

// ── Goal categories ────────────────────────────────────────────────
const GOAL_CATEGORIES = [
  {
    label: "Body & Health",
    goals: [
      { label: "Build strength", emoji: "💪" },
      { label: "Lose weight", emoji: "🔥" },
      { label: "Improve fitness", emoji: "🏃" },
      { label: "Drink more water", emoji: "💧" },
      { label: "Sleep better", emoji: "😴" },
    ],
  },
  {
    label: "Mind",
    goals: [
      { label: "Reduce stress", emoji: "🧘" },
      { label: "Mental clarity & focus", emoji: "🧠" },
      { label: "Journalling & self-reflection", emoji: "📓" },
    ],
  },
  {
    label: "Spirit",
    goals: [
      { label: "Spirituality & faith", emoji: "🙏" },
      { label: "Manifestation & intention", emoji: "✨" },
      { label: "Mindfulness & presence", emoji: "🌿" },
    ],
  },
  {
    label: "Life & Growth",
    goals: [
      { label: "Track habits", emoji: "📊" },
      { label: "Personal goals", emoji: "🎯" },
      { label: "Read & learn more", emoji: "📚" },
      { label: "Improve mood", emoji: "💛" },
    ],
  },
  {
    label: "Relationships",
    goals: [
      { label: "Be present as parent/partner", emoji: "👨‍👩‍👧" },
      { label: "Find meaning & purpose", emoji: "🌟" },
      { label: "Better connection", emoji: "💬" },
    ],
  },
];

// ── Module metadata ────────────────────────────────────────────────
const MODULE_DESCRIPTIONS: Record<string, string> = {
  "Calorie Tracker": "Log meals, calories, and macros",
  "Water Intake": "Track your daily water consumption",
  "Workout Log": "Record your exercise sessions",
  "Steps Counter": "Count your daily steps",
  "Mood Check-in": "Check in with your emotional wellbeing",
  "Sleep Tracker": "Monitor your sleep duration",
  "Daily Habits Checklist": "Build and track daily habits",
  "Motivation Bot": "Get daily motivation and inspiration",
  "Daily Journal": "Write freely — thoughts, feelings, events",
  "Gratitude Log": "Three things you're grateful for, daily",
  "Prayer/Reflection Log": "A quiet space for faith and reflection",
  "Manifestation Journal": "Write your intentions into reality",
  "Daily Intentions": "Set a clear intention for the day",
  "Meditation Tracker": "Track your meditation practice",
  "Mindfulness Check-in": "Pause and notice the present moment",
  "Goal Tracker": "Your personal goals checklist",
  "Reading Log": "Track what you're reading",
  "Connection Log": "Note meaningful moments with people you love",
  "Purpose Journal": "Explore what gives your life meaning",
  "Focus Session Tracker": "Log deep work and focus sessions",
};

const MODULE_EMOJIS: Record<string, string> = {
  "Calorie Tracker": "🔥",
  "Water Intake": "💧",
  "Workout Log": "💪",
  "Steps Counter": "👟",
  "Mood Check-in": "🧘",
  "Sleep Tracker": "😴",
  "Daily Habits Checklist": "📋",
  "Motivation Bot": "✨",
  "Daily Journal": "📓",
  "Gratitude Log": "🙏",
  "Prayer/Reflection Log": "🕊️",
  "Manifestation Journal": "🌟",
  "Daily Intentions": "🎯",
  "Meditation Tracker": "🧘",
  "Mindfulness Check-in": "🌿",
  "Goal Tracker": "🎯",
  "Reading Log": "📚",
  "Connection Log": "💛",
  "Purpose Journal": "🌟",
  "Focus Session Tracker": "🧠",
};

// ── Goal → module mapping ──────────────────────────────────────────
function getSuggestedModules(goals: string[]): string[] {
  const suggested = new Set<string>();

  if (goals.includes("Lose weight") || goals.includes("Improve fitness")) {
    suggested.add("Calorie Tracker");
  }
  if (goals.includes("Drink more water")) {
    suggested.add("Water Intake");
  }
  if (goals.includes("Build strength") || goals.includes("Improve fitness")) {
    suggested.add("Workout Log");
    suggested.add("Steps Counter");
  }
  if (goals.includes("Reduce stress") || goals.includes("Sleep better")) {
    suggested.add("Mood Check-in");
    suggested.add("Sleep Tracker");
  }
  if (goals.includes("Reduce stress") || goals.includes("Mindfulness & presence")) {
    suggested.add("Meditation Tracker");
    suggested.add("Mindfulness Check-in");
  }
  if (goals.includes("Track habits")) {
    suggested.add("Daily Habits Checklist");
  }
  if (goals.includes("Journalling & self-reflection")) {
    suggested.add("Daily Journal");
  }
  if (goals.includes("Spirituality & faith")) {
    suggested.add("Gratitude Log");
    suggested.add("Prayer/Reflection Log");
  }
  if (goals.includes("Manifestation & intention")) {
    suggested.add("Manifestation Journal");
    suggested.add("Daily Intentions");
  }
  if (goals.includes("Personal goals")) {
    suggested.add("Goal Tracker");
  }
  if (goals.includes("Read & learn more")) {
    suggested.add("Reading Log");
  }
  if (goals.includes("Improve mood")) {
    suggested.add("Mood Check-in");
    suggested.add("Gratitude Log");
  }
  if (goals.includes("Be present as parent/partner")) {
    suggested.add("Connection Log");
  }
  if (goals.includes("Find meaning & purpose")) {
    suggested.add("Purpose Journal");
  }
  if (goals.includes("Mental clarity & focus")) {
    suggested.add("Focus Session Tracker");
  }

  // Always suggest Motivation Bot
  suggested.add("Motivation Bot");

  return Array.from(suggested);
}

// ── Colour picker ──────────────────────────────────────────────────
const COLORS = [
  { label: "Green", hex: "#5cb85c" },
  { label: "Blue", hex: "#3b82f6" },
  { label: "Purple", hex: "#a855f7" },
  { label: "Orange", hex: "#f97316" },
  { label: "Pink", hex: "#ec4899" },
  { label: "Teal", hex: "#14b8a6" },
  { label: "Red", hex: "#ef4444" },
  { label: "Yellow", hex: "#eab308" },
];

interface Props {
  person: string;
  name: string;
  onComplete: () => void;
}

export default function OnboardingWizard({ person, name, onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [visible, setVisible] = useState(true);

  // Step 1
  const [age, setAge] = useState("");
  const [heightVal, setHeightVal] = useState("");
  const [heightUnit, setHeightUnit] = useState<"cm" | "ft">("cm");
  const [weightVal, setWeightVal] = useState("");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");

  // Step 2
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  // Step 3
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [modulesInitialized, setModulesInitialized] = useState(false);

  // Step 4
  const [selectedColor, setSelectedColor] = useState("#5cb85c");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function transitionToStep(next: number) {
    setVisible(false);
    setTimeout(() => {
      if (next === 3 && !modulesInitialized) {
        const suggested = getSuggestedModules(selectedGoals);
        setSelectedModules(suggested);
        setModulesInitialized(true);
      }
      setStep(next);
      setVisible(true);
    }, 200);
  }

  function toggleGoal(label: string) {
    setSelectedGoals((g) =>
      g.includes(label) ? g.filter((x) => x !== label) : [...g, label]
    );
    // Reset module init so re-entry to step 3 re-computes
    setModulesInitialized(false);
  }

  function toggleModule(label: string) {
    setSelectedModules((m) =>
      m.includes(label) ? m.filter((x) => x !== label) : [...m, label]
    );
  }

  async function handleFinish() {
    setSaving(true);
    setError("");
    try {
      let heightCm: number | undefined;
      if (heightVal) {
        const hNum = parseFloat(heightVal);
        if (!isNaN(hNum)) {
          heightCm = heightUnit === "ft" ? Math.round(hNum * 30.48) : hNum;
        }
      }
      let weightKg: number | undefined;
      if (weightVal) {
        const wNum = parseFloat(weightVal);
        if (!isNaN(wNum)) {
          weightKg = weightUnit === "lbs" ? Math.round(wNum * 0.453592 * 10) / 10 : wNum;
        }
      }

      const settings: Record<string, unknown> = {
        onboarded: true,
        goals: selectedGoals,
        moduleColors: { global: selectedColor },
      };
      if (age) settings.age = parseInt(age, 10);
      if (heightCm !== undefined) settings.heightCm = heightCm;
      if (weightKg !== undefined) settings.weightKg = weightKg;

      const modulePayload = selectedModules.map((label) => ({ label }));

      const res = await fetch("/api/personal/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person, modules: modulePayload, settings }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Onboarding failed");

      setVisible(false);
      setTimeout(() => onComplete(), 250);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  // ── Shared styles ────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: cardBg,
    border: `1px solid ${border}`,
    borderRadius: "16px",
    padding: "32px",
    opacity: visible ? 1 : 0,
    transition: "opacity 0.2s ease",
  };

  const btnPrimary = (color: string): React.CSSProperties => ({
    background: color,
    color: bg,
    fontWeight: 700,
    border: "none",
    borderRadius: "10px",
    padding: "12px 28px",
    fontSize: "15px",
    cursor: "pointer",
    marginTop: "24px",
    display: "inline-block",
  });

  const inputStyle: React.CSSProperties = {
    background: inputBg,
    border: `1px solid ${border}`,
    borderRadius: "10px",
    padding: "10px 14px",
    color: textPrimary,
    fontSize: "15px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  const unitToggle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px",
    borderRadius: "8px",
    border: `1px solid ${border}`,
    background: active ? "#3d6b3d" : "transparent",
    color: active ? textPrimary : textSecondary,
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: active ? 600 : 400,
  });

  const suggestedModules = getSuggestedModules(selectedGoals);

  return (
    <div style={cardStyle}>
      {/* Step indicator */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "28px", justifyContent: "center" }}>
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            style={{
              width: s === step ? "28px" : "8px",
              height: "8px",
              borderRadius: "4px",
              background: s === step ? selectedColor : s < step ? "#3d6b3d" : "rgba(61,107,61,0.3)",
              transition: "all 0.3s ease",
            }}
          />
        ))}
      </div>

      {/* ── Step 1: Welcome + basics ────────────────────────────── */}
      {step === 1 && (
        <div>
          <h2 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: 800, color: textPrimary }}>
            Welcome to Fresh, {name} 👋
          </h2>
          <p style={{ margin: "0 0 28px", color: textSecondary, fontSize: "15px" }}>
            Let&apos;s set up your dashboard in 2 minutes.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: textSecondary, marginBottom: "6px" }}>Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 32"
                style={{ ...inputStyle, width: "160px" }}
                min="10"
                max="120"
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: textSecondary, marginBottom: "6px" }}>Height</label>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  type="number"
                  value={heightVal}
                  onChange={(e) => setHeightVal(e.target.value)}
                  placeholder={heightUnit === "cm" ? "e.g. 175" : "e.g. 5.9"}
                  style={{ ...inputStyle, width: "120px" }}
                  min="0"
                />
                <div style={{ display: "flex", gap: "6px" }}>
                  <button style={unitToggle(heightUnit === "cm")} onClick={() => setHeightUnit("cm")}>cm</button>
                  <button style={unitToggle(heightUnit === "ft")} onClick={() => setHeightUnit("ft")}>ft</button>
                </div>
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: textSecondary, marginBottom: "6px" }}>Weight</label>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  type="number"
                  value={weightVal}
                  onChange={(e) => setWeightVal(e.target.value)}
                  placeholder={weightUnit === "kg" ? "e.g. 75" : "e.g. 165"}
                  style={{ ...inputStyle, width: "120px" }}
                  min="0"
                />
                <div style={{ display: "flex", gap: "6px" }}>
                  <button style={unitToggle(weightUnit === "kg")} onClick={() => setWeightUnit("kg")}>kg</button>
                  <button style={unitToggle(weightUnit === "lbs")} onClick={() => setWeightUnit("lbs")}>lbs</button>
                </div>
              </div>
            </div>
          </div>

          <button style={btnPrimary(selectedColor)} onClick={() => transitionToStep(2)}>
            Next →
          </button>
        </div>
      )}

      {/* ── Step 2: Goals by category ───────────────────────────── */}
      {step === 2 && (
        <div>
          <h2 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: 800, color: textPrimary }}>
            What are you hoping to achieve?
          </h2>
          <p style={{ margin: "0 0 24px", color: textSecondary, fontSize: "15px" }}>
            Pick as many as you like across any area of life.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {GOAL_CATEGORIES.map(({ label: catLabel, goals }) => (
              <div key={catLabel}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b9b6b", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "10px" }}>
                  {catLabel}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {goals.map(({ label, emoji }) => {
                    const active = selectedGoals.includes(label);
                    return (
                      <button
                        key={label}
                        onClick={() => toggleGoal(label)}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "100px",
                          border: `2px solid ${active ? selectedColor : border}`,
                          background: active ? `${selectedColor}22` : "transparent",
                          color: active ? selectedColor : textSecondary,
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: active ? 600 : 400,
                          boxShadow: active ? `0 0 0 2px ${selectedColor}33` : "none",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {emoji} {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <button style={btnPrimary(selectedColor)} onClick={() => transitionToStep(3)}>
            Next →
          </button>
        </div>
      )}

      {/* ── Step 3: Module suggestions ──────────────────────────── */}
      {step === 3 && (
        <div>
          <h2 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: 800, color: textPrimary }}>
            Here&apos;s what we&apos;d suggest for you
          </h2>
          <p style={{ margin: "0 0 24px", color: textSecondary, fontSize: "15px" }}>
            Toggle off anything you don&apos;t want.
          </p>

          {suggestedModules.length === 0 ? (
            <p style={{ color: textSecondary, fontSize: "14px" }}>
              Select some goals to see suggestions. Motivation Bot is always included.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "380px", overflowY: "auto", paddingRight: "4px" }}>
              {suggestedModules.map((label) => {
                const active = selectedModules.includes(label);
                return (
                  <button
                    key={label}
                    onClick={() => toggleModule(label)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      padding: "14px 16px",
                      borderRadius: "12px",
                      border: `2px solid ${active ? selectedColor : border}`,
                      background: active ? `${selectedColor}18` : cardBg2,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                      position: "relative",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: "22px" }}>{MODULE_EMOJIS[label] ?? "📌"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: textPrimary }}>{label}</div>
                      <div style={{ fontSize: "12px", color: textSecondary }}>{MODULE_DESCRIPTIONS[label] ?? ""}</div>
                    </div>
                    {/* Toggle pill */}
                    <div
                      style={{
                        width: "36px",
                        height: "20px",
                        borderRadius: "10px",
                        background: active ? selectedColor : "#3d6b3d",
                        position: "relative",
                        transition: "background 0.2s ease",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          background: "#fff",
                          position: "absolute",
                          top: "2px",
                          left: active ? "18px" : "2px",
                          transition: "left 0.2s ease",
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <button style={btnPrimary(selectedColor)} onClick={() => transitionToStep(4)}>
            Next →
          </button>
        </div>
      )}

      {/* ── Step 4: Colour theme ────────────────────────────────── */}
      {step === 4 && (
        <div>
          <h2 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: 800, color: textPrimary }}>
            Pick your colour
          </h2>
          <p style={{ margin: "0 0 28px", color: textSecondary, fontSize: "15px" }}>
            Sets the accent colour for your whole dashboard.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
            {COLORS.map(({ label, hex }) => (
              <button
                key={hex}
                onClick={() => setSelectedColor(hex)}
                title={label}
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: hex,
                  border: "none",
                  cursor: "pointer",
                  boxShadow:
                    selectedColor === hex
                      ? `0 0 0 3px ${bg}, 0 0 0 6px #fff`
                      : "0 2px 8px rgba(0,0,0,0.3)",
                  transition: "box-shadow 0.15s ease",
                }}
                aria-label={label}
              />
            ))}
          </div>

          {error && (
            <p style={{ color: "#ff6b6b", fontSize: "13px", marginTop: "16px" }}>{error}</p>
          )}

          <button
            style={{ ...btnPrimary(selectedColor), opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }}
            onClick={handleFinish}
            disabled={saving}
          >
            {saving ? "Setting up…" : "Let's go! 🚀"}
          </button>
        </div>
      )}
    </div>
  );
}
