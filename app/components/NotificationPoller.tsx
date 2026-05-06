"use client";

/**
 * Polls /api/support every 60s and fires a browser notification whenever
 * a new conversation UUID appears.  Runs at the layout level so it works
 * on every page — not just /support.
 *
 * Seen UUIDs are persisted in localStorage so navigating between pages
 * does not re-trigger notifications for already-known conversations.
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const POLL_INTERVAL_MS = 60_000;
const LS_KEY = "mc_seen_conv_uuids";
const MAX_STORED = 2000; // cap localStorage growth

// Desktop shell bridge (Electron preload exposes window.mcShell). Falls back
// to web Notification API when running in a regular browser tab.
type McShell = {
  notify?: (opts: { title: string; body?: string; url?: string }) => void;
  setBadge?: (n: number) => void;
};
function getShell(): McShell | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { mcShell?: McShell }).mcShell ?? null;
}
function fireNotification(title: string, body: string, url?: string) {
  const shell = getShell();
  if (shell?.notify) {
    shell.notify({ title, body, url });
    return;
  }
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  }
}
let lastBadge = -1;
function setBadge(n: number) {
  if (n === lastBadge) return;
  lastBadge = n;
  const shell = getShell();
  shell?.setBadge?.(n);
  // Also reflect in the page title so the desktop shell's title-based badge
  // reader and browser tabs both pick it up.
  if (typeof document !== "undefined") {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = n > 0 ? `(${n}) ${base}` : base;
  }
}

function getSeenUuids(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {}
  return new Set();
}

function persistSeenUuids(set: Set<string>) {
  try {
    // Keep the most recent MAX_STORED entries to avoid unbounded growth
    const arr = Array.from(set).slice(-MAX_STORED);
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  } catch {}
}

export default function NotificationPoller() {
  const pathname    = usePathname();
  const initialised = useRef(false);

  useEffect(() => {
    // Don't run on the login page
    if (pathname.startsWith("/login")) return;
    // Avoid double-mounting in StrictMode
    if (initialised.current) return;
    initialised.current = true;

    // Request notification permission once. The desktop shell handles its
    // own native notifications, so only ask in the browser.
    if (!getShell() && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    let firstPoll = true;
    let unread = 0;

    async function poll() {
      const canNotify = !!getShell() || (("Notification" in window) && Notification.permission === "granted");
      if (!canNotify) {
        firstPoll = false; // still advance so the next grant works
        return;
      }

      try {
        const res = await fetch("/api/support", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();

        const seen = getSeenUuids();
        const allConvs: { uuid: string; name: string; channel: string; preview: string; site: string }[] = [];

        for (const site of data.sites ?? []) {
          for (const conv of site.conversations ?? []) {
            allConvs.push({
              uuid:    conv.uuid,
              name:    conv.customer_name || "Guest",
              channel: conv.channel,
              preview: conv.last_msg_preview || "",
              site:    site.site?.name || "",
            });
          }
        }

        if (firstPoll) {
          // Seed without notifying — just mark everything currently known
          firstPoll = false;
          for (const c of allConvs) seen.add(c.uuid);
          persistSeenUuids(seen);
          return;
        }

        const newConvs = allConvs.filter((c) => !seen.has(c.uuid));
        for (const c of newConvs) {
          const title = c.channel === "email" ? "New email" : "New chat";
          const body  = [
            c.name,
            c.site  ? `(${c.site})` : "",
            c.preview ? `— ${c.preview.slice(0, 80)}` : "",
          ].filter(Boolean).join(" ");

          fireNotification(title, body, c.channel === "email" ? "/support" : "/support");
          seen.add(c.uuid);
        }

        if (newConvs.length > 0) {
          persistSeenUuids(seen);
          unread += newConvs.length;
          setBadge(unread);
        }

        // Clear the badge when the user is actively on /support — they've seen it.
        if (typeof window !== "undefined" && window.location.pathname.startsWith("/support") && unread > 0) {
          unread = 0;
          setBadge(0);
        }
      } catch {}
    }

    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
    // Only run once on mount — pathname changes shouldn't restart the poller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
