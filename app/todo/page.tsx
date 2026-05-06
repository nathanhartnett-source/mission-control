"use client";

import { useCallback, useEffect, useState } from "react";

interface TodoItem {
  text: string;
  quadrant?: "Q1" | "Q2" | "Q3" | "Q4" | "Q?";
}

const QUAD_COLORS: Record<string, string> = {
  Q1: "bg-rose-600/20 text-rose-300 border-rose-700/40",
  Q2: "bg-amber-600/20 text-amber-300 border-amber-700/40",
  Q3: "bg-sky-600/20 text-sky-300 border-sky-700/40",
  Q4: "bg-slate-700/40 text-slate-400 border-slate-700/40",
  "Q?": "bg-slate-700/40 text-slate-400 border-slate-700/40",
};

export default function TodoPage() {
  const [person, setPerson] = useState<string | null>(null);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [busyIdx, setBusyIdx] = useState<number | null>(null);

  const refresh = useCallback(async (p: string) => {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      if (!res.ok) {
        setError(`Couldn't load todos (status ${res.status})`);
        return;
      }
      const data = await res.json();
      const me = (data.people || []).find((x: { id: string }) => x.id === p);
      setTodos((me?.todos as TodoItem[]) || []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me").then(async (r) => {
      if (!r.ok) {
        setLoading(false);
        setError("Please log in.");
        return;
      }
      const d = await r.json().catch(() => ({}));
      const username = d?.user?.username as string | undefined;
      if (!username) { setLoading(false); setError("No user."); return; }
      if (username !== "tessa") {
        setLoading(false);
        setError(`To-Do list isn't set up for "${username}" yet.`);
        return;
      }
      if (!alive) return;
      setPerson(username);
      await refresh(username);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [refresh]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!person || !newText.trim()) return;
    setAdding(true);
    try {
      const body: { text: string; deadline?: string } = { text: newText.trim() };
      if (newDeadline) body.deadline = newDeadline;
      const res = await fetch(`/api/todos/${person}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || `Add failed (${res.status})`);
      } else {
        setNewText("");
        setNewDeadline("");
        setShowAdd(false);
        await refresh(person);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const changeQuadrant = async (idx: number, direction: "up" | "down") => {
    if (!person) return;
    const current = todos[idx]?.quadrant || "Q4";
    const upMap: Record<string, string> = { Q4: "Q3", Q3: "Q2", Q2: "Q1", Q1: "Q1", "Q?": "Q2" };
    const downMap: Record<string, string> = { Q1: "Q2", Q2: "Q3", Q3: "Q4", Q4: "Q4", "Q?": "Q4" };
    const newQuadrant = (direction === "up" ? upMap : downMap)[current] || "Q4";
    setBusyIdx(idx);
    try {
      const res = await fetch(`/api/todos/${person}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index: idx, newQuadrant, actor: "ui" }),
      });
      if (res.ok) await refresh(person);
    } finally {
      setBusyIdx(null);
    }
  };

  const archive = async (idx: number) => {
    if (!person) return;
    if (!confirm("Tick off / archive this item?")) return;
    setBusyIdx(idx);
    try {
      const res = await fetch(`/api/todos/${person}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index: idx, actor: "ui", reason: "ticked off via UI" }),
      });
      if (res.ok) await refresh(person);
    } finally {
      setBusyIdx(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen md:ml-52 p-6 text-slate-300">
        <p>Loading…</p>
      </main>
    );
  }

  const grouped: Record<string, { idx: number; todo: TodoItem }[]> = { Q1: [], Q2: [], Q3: [], Q4: [], "Q?": [] };
  todos.forEach((t, i) => {
    const q = t.quadrant || "Q?";
    (grouped[q] ||= []).push({ idx: i, todo: t });
  });

  return (
    <main className="min-h-screen md:ml-52 p-4 md:p-8 text-slate-200 bg-slate-950">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">To-Do</h1>
            <p className="text-xs text-slate-500 mt-1">
              {person ? `${person} · ${todos.length} item${todos.length === 1 ? "" : "s"}` : ""}
            </p>
          </div>
          {!showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="text-sm px-4 py-2 rounded-lg bg-indigo-600/30 text-indigo-200 border border-indigo-700/50 hover:bg-indigo-600/50 transition-colors"
            >
              + Add task
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-900/30 border border-rose-700/40 text-sm text-rose-200">
            {error}
          </div>
        )}

        {showAdd && (
          <form
            onSubmit={handleAdd}
            className="mb-6 p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3"
          >
            <input
              type="text"
              autoFocus
              placeholder="Task description…"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-700"
            />
            <input
              type="date"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm bg-slate-950 border border-slate-800 text-slate-400 focus:outline-none focus:border-indigo-700"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={adding || !newText.trim()}
                className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-500 transition-colors"
              >
                {adding ? "Adding…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => { setShowAdd(false); setNewText(""); setNewDeadline(""); }}
                className="text-sm px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {todos.length === 0 && !error ? (
          <p className="text-sm text-slate-500">Nothing here yet. Add a task to get started.</p>
        ) : (
          (["Q1", "Q2", "Q3", "Q4", "Q?"] as const).map((q) => {
            const rows = grouped[q] || [];
            if (rows.length === 0) return null;
            const labels: Record<string, string> = {
              Q1: "Urgent · Important",
              Q2: "Important · Not urgent",
              Q3: "Urgent · Not important",
              Q4: "Not urgent · Not important",
              "Q?": "Unsorted",
            };
            return (
              <section key={q} className="mb-6">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
                  {labels[q]} <span className="text-slate-600 font-normal">({rows.length})</span>
                </h2>
                <ul className="space-y-1.5">
                  {rows.map(({ idx, todo }) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                      <button
                        onClick={() => archive(idx)}
                        disabled={busyIdx === idx}
                        title="Tick off (archives the item)"
                        className="mt-0.5 w-5 h-5 rounded-md border border-slate-700 bg-slate-950 hover:border-emerald-500 hover:bg-emerald-500/10 disabled:opacity-40 transition-colors flex-shrink-0"
                      />
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-mono mt-0.5 ${QUAD_COLORS[todo.quadrant || "Q?"]}`}
                      >
                        {todo.quadrant || "Q?"}
                      </span>
                      <span className="flex-1 text-sm text-slate-200">{todo.text}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => changeQuadrant(idx, "up")}
                          disabled={busyIdx === idx}
                          title="More important"
                          className="text-xs px-2 py-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-40 transition-colors"
                        >▲</button>
                        <button
                          onClick={() => changeQuadrant(idx, "down")}
                          disabled={busyIdx === idx}
                          title="Less important"
                          className="text-xs px-2 py-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-40 transition-colors"
                        >▼</button>
                        <button
                          onClick={() => archive(idx)}
                          disabled={busyIdx === idx}
                          title="Delete"
                          className="text-xs px-2 py-1 rounded text-slate-600 hover:text-rose-300 hover:bg-rose-900/30 disabled:opacity-40 transition-colors"
                        >✕</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}
