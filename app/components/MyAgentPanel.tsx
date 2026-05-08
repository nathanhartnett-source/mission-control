"use client";

import { useCallback, useEffect, useState } from "react";
import PixelAvatar from "@/app/components/PixelAvatar";
import { rollAvatarSeed, agentAvatarSeed } from "@/lib/avatar";
import { useMe } from "@/app/components/MeProvider";

export default function MyAgentPanel() {
  const { me, refresh } = useMe();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<null | "name" | "avatar">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [agentSeed, setAgentSeed] = useState<string>("");

  useEffect(() => {
    if (me?.agentName) setName(me.agentName);
    const seed = me?.agentAvatarSeeds?.me || agentAvatarSeed("me", me?.username || "user");
    setAgentSeed(seed);
  }, [me?.agentName, me?.agentAvatarSeeds, me?.username]);

  const saveName = useCallback(async () => {
    setBusy("name"); setErr(null); setMsg(null);
    try {
      const r = await fetch("/api/me/agent-name", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentName: name.trim() }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setMsg("Saved");
      await refresh();
      setTimeout(() => setMsg(null), 2000);
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(null); }
  }, [name, refresh]);

  const rerollAvatar = useCallback(async () => {
    setBusy("avatar"); setErr(null); setMsg(null);
    const newSeed = rollAvatarSeed("agent:me");
    setAgentSeed(newSeed);
    try {
      const r = await fetch("/api/me/avatar", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: newSeed, agent: "me" }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setMsg("Saved");
      await refresh();
      setTimeout(() => setMsg(null), 2000);
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(null); }
  }, [refresh]);

  if (!me) return null;
  const dirty = name.trim() && name.trim() !== (me.agentName || "");

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">Your agent</h2>
      <div className="flex items-center gap-4 mb-4">
        {agentSeed ? <PixelAvatar seed={agentSeed} size={72} /> : <div className="w-[72px] h-[72px] rounded-md bg-slate-800" />}
        <div>
          <div className="text-sm text-slate-300 mb-1">Agent avatar</div>
          <button
            onClick={rerollAvatar}
            disabled={busy === "avatar"}
            className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium"
          >🎲 Re-roll</button>
        </div>
      </div>
      <label className="text-xs text-slate-300 block">
        Agent name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
        />
      </label>
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={saveName}
          disabled={busy === "name" || !dirty}
          className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs"
        >{busy === "name" ? "Saving…" : "Save name"}</button>
        {msg && <span className="text-xs text-emerald-400">{msg}</span>}
        {err && <span className="text-xs text-rose-400">{err}</span>}
      </div>
    </section>
  );
}
