"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { marked } from "marked";

type Msg = {
  id: string;
  from: string;
  subject: string;
  body: string;
  href?: string;
  level?: "info" | "warn" | "error" | "success";
  read: boolean;
  ts: string;
};

const LEVEL_DOT: Record<string, string> = {
  info: "bg-slate-500",
  warn: "bg-amber-400",
  error: "bg-rose-500",
  success: "bg-emerald-400",
};

function fmtAest(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-AU", { timeZone: "Australia/Brisbane", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

function snippet(body: string, max = 140): string {
  if (!body) return "";
  const cleaned = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[#>*_~|`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > max ? cleaned.slice(0, max - 1) + "…" : cleaned;
}

export default function InboxPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/inbox").then(r => r.json()).then(d => {
      setMessages(d.messages || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch("/api/inbox", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "markAllRead" }) })
        .then(() => window.dispatchEvent(new Event("mc-inbox-changed")))
        .catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  const del = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/inbox/${id}`, { method: "DELETE" });
    setMessages(m => m.filter(x => x.id !== id));
    if (openId === id) setOpenId(null);
    toast.success("Deleted");
  };

  return (
    <main className="max-w-3xl mx-auto px-3 sm:px-6 py-6 sm:py-10 text-slate-200">
      <div className="px-1 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold">Inbox</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Alerts and messages from your agent.</p>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500 px-3">Loading…</div>
      ) : messages.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-xl p-8 sm:p-12 text-center text-slate-500 mx-1">
          <div className="text-3xl sm:text-4xl mb-2">📬</div>
          <div className="text-sm font-medium">No messages</div>
          <div className="text-xs mt-1">Your agent will drop alerts here when something needs your attention.</div>
        </div>
      ) : (
        <ul className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-900/30">
          {messages.map((m) => {
            const isOpen = openId === m.id;
            return (
              <li key={m.id}>
                <button
                  onClick={() => setOpenId(isOpen ? null : m.id)}
                  className={`w-full text-left px-3 py-3 sm:px-4 sm:py-3 transition-colors ${isOpen ? "bg-slate-900/60" : m.read ? "hover:bg-slate-900/40" : "bg-indigo-950/15 hover:bg-indigo-950/25"}`}
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    <span className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${LEVEL_DOT[m.level || "info"]}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className={`text-sm truncate ${m.read ? "text-slate-200" : "font-semibold text-white"}`}>{m.subject}</div>
                        <div className="text-[11px] text-slate-500 shrink-0">{fmtAest(m.ts)}</div>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{m.from}</div>
                      {!isOpen && (
                        <div className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{snippet(m.body)}</div>
                      )}
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-3 sm:px-4 pb-4 -mt-1">
                    <div
                      className="text-sm text-slate-200 leading-relaxed overflow-x-auto
                        [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-slate-100 [&_h1]:mt-3 [&_h1]:mb-1.5
                        [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-slate-100 [&_h2]:mt-3 [&_h2]:mb-1.5
                        [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-100 [&_h3]:mt-2 [&_h3]:mb-1
                        [&_p]:my-2
                        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2
                        [&_li]:my-0.5
                        [&_strong]:text-white [&_strong]:font-semibold
                        [&_code]:text-amber-300 [&_code]:bg-slate-800/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                        [&_pre]:bg-slate-950 [&_pre]:border [&_pre]:border-slate-800 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:my-2 [&_pre>code]:bg-transparent [&_pre>code]:px-0
                        [&_table]:text-xs [&_table]:my-3 [&_table]:border-collapse [&_table]:w-auto
                        [&_th]:border [&_th]:border-slate-700 [&_th]:bg-slate-800/60 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left
                        [&_td]:border [&_td]:border-slate-800 [&_td]:px-2 [&_td]:py-1
                        [&_a]:text-indigo-400 hover:[&_a]:underline
                        [&_hr]:border-slate-800 [&_hr]:my-3
                        [&_blockquote]:border-l-2 [&_blockquote]:border-slate-700 [&_blockquote]:pl-3 [&_blockquote]:text-slate-400 [&_blockquote]:italic"
                      dangerouslySetInnerHTML={{ __html: marked.parse(m.body || "", { breaks: true, gfm: true }) as string }}
                    />
                    <div className="flex items-center gap-2 mt-3">
                      {m.href && <a href={m.href} className="text-xs px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-500">Open</a>}
                      <button onClick={(e) => del(m.id, e)} className="text-xs px-3 py-1.5 rounded-md bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-rose-300 ml-auto">Delete</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
