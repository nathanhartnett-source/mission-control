"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Me = {
  id: string;
  username: string;
  email?: string;
  isAdmin?: boolean;
  agentName?: string | null;
  avatarSeed?: string;
  agentAvatarSeeds?: Record<string, string>;
  agentNames?: Record<string, string>;
  personaCompleted?: boolean;
} | null;

type Ctx = {
  me: Me;
  loaded: boolean;
  refresh: () => Promise<void>;
  setMe: (m: Me) => void;
};

const MeContext = createContext<Ctx | null>(null);

export function MeProvider({ initial, children }: { initial: Me; children: ReactNode }) {
  const [me, setMe] = useState<Me>(initial);
  const [loaded, setLoaded] = useState<boolean>(initial != null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      if (!r.ok) { setMe(null); setLoaded(true); return; }
      const d = await r.json().catch(() => ({}));
      setMe(d?.user ?? null);
      setLoaded(true);
    } catch { setLoaded(true); }
  }, []);

  // Always refresh once on mount: server-seeded `initial` from layout.tsx
  // omits agentName (which is read per-request from persona.md). Without
  // this refresh, /agents shows "Your agent" instead of the configured name.
  useEffect(() => { refresh(); }, [refresh]);

  return <MeContext.Provider value={{ me, loaded, refresh, setMe }}>{children}</MeContext.Provider>;
}

export function useMe(): Ctx {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe() must be used inside <MeProvider>");
  return ctx;
}
