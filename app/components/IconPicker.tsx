"use client";

import { useEffect, useState } from "react";

const SUGGESTED = [
  "📂", "📁", "📦", "🗂", "🗃", "📋", "📝", "📌",
  "🏠", "🤖", "📚", "✅", "🔁", "💬", "🎬", "🛟",
  "📊", "📈", "🏢", "🎯", "🏛", "🏃", "🛠", "✨",
  "💰", "🛍", "🛒", "📧", "📞", "📅", "🎨", "🔧",
  "⚡", "🚀", "💡", "🔥", "⭐", "🌟", "❤", "💎",
  "🔍", "🔐", "📡", "🌐", "📱", "💻", "🖥", "⚙",
];

export default function IconPicker({
  open,
  current,
  onPick,
  onClose,
  title = "Choose an icon",
}: {
  open: boolean;
  current?: string;
  onPick: (icon: string) => void;
  onClose: () => void;
  title?: string;
}) {
  const [draft, setDraft] = useState(current || "");
  useEffect(() => { if (open) setDraft(current || ""); }, [open, current]);
  if (!open) return null;

  const commit = (val: string) => {
    const v = (val || "").trim().slice(0, 8);
    if (!v) return;
    onPick(v);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 w-[360px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <div className="text-base font-semibold text-slate-100 mb-3">{title}</div>
        <div className="flex items-center gap-2 mb-4">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(draft); if (e.key === "Escape") onClose(); }}
            placeholder="Type or paste an emoji"
            maxLength={8}
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-base text-slate-100 placeholder-slate-500"
          />
          <button onClick={() => commit(draft)} className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium">Use</button>
        </div>
        <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-500 mb-2">Suggested</div>
        <div className="grid grid-cols-8 gap-1.5">
          {SUGGESTED.map((emo) => (
            <button
              key={emo}
              onClick={() => commit(emo)}
              className={`aspect-square text-xl rounded hover:bg-slate-800 transition-colors ${current === emo ? "ring-2 ring-indigo-500 bg-slate-800" : ""}`}
            >{emo}</button>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="text-sm px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700">Cancel</button>
        </div>
      </div>
    </div>
  );
}
