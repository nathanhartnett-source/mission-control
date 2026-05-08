"use client";

import { useEffect, useRef, useState } from "react";

interface MacroSummary {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  entries: number;
}

interface Targets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Props {
  person: string;
  targets: Targets;
}

const cardBase = "bg-[#2d4a2d] border border-[#3d6b3d] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.3)]";

function MacroBar({
  label,
  current,
  target,
  unit,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
}) {
  const pct = target > 0 ? Math.min((current / target) * 100, 150) : 0;
  const displayPct = target > 0 ? Math.round((current / target) * 100) : 0;

  let barColor: string;
  if (displayPct >= 100) {
    barColor = "bg-red-500";
  } else if (displayPct >= 80) {
    barColor = "bg-amber-400";
  } else {
    barColor = "bg-emerald-500";
  }

  let textColor: string;
  if (displayPct >= 100) {
    textColor = "#ff6b6b";
  } else if (displayPct >= 80) {
    textColor = "#e8b84c";
  } else {
    textColor = "#5cb85c";
  }

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: "#a8c8a8" }}>{label}</span>
        <span className="text-xs font-semibold" style={{ color: textColor }}>
          {current}
          {unit} / {target}
          {unit}
          <span className="font-normal ml-1" style={{ color: "#6b9b6b" }}>({displayPct}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#1f3a1f" }}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function MacrosSummary({ person, targets }: Props) {
  const [summary, setSummary] = useState<MacroSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSummary = async () => {
    try {
      const res = await fetch(`/api/personal/nutrition-summary?person=${person}`, {
        cache: "no-store",
      });
      if (res.ok) {
        setSummary(await res.json());
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    intervalRef.current = setInterval(fetchSummary, 5 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person]);

  return (
    <div className={`${cardBase} p-5 mb-6`}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: "#e8f5e8" }}>Today&apos;s Macros</h2>

      {loading ? (
        <p className="text-sm" style={{ color: "#a8c8a8" }}>Loading...</p>
      ) : !summary || summary.entries === 0 ? (
        <p className="text-sm" style={{ color: "#a8c8a8" }}>Nothing logged yet today</p>
      ) : (
        <>
          <MacroBar
            label="Calories"
            current={summary.calories}
            target={targets.calories}
            unit=" kcal"
          />
          <MacroBar
            label="Protein"
            current={summary.protein}
            target={targets.protein}
            unit="g"
          />
          <MacroBar
            label="Carbs"
            current={summary.carbs}
            target={targets.carbs}
            unit="g"
          />
          <MacroBar
            label="Fat"
            current={summary.fat}
            target={targets.fat}
            unit="g"
          />
          <p className="text-xs mt-2" style={{ color: "#6b9b6b" }}>
            Based on {summary.entries} meal{summary.entries !== 1 ? "s" : ""} logged today · refreshes every 5 min
          </p>
        </>
      )}
    </div>
  );
}
