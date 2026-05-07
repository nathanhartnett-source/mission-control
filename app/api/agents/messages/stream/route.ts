import { NextRequest } from "next/server";
import fs from "fs";
import { OUTBOX_DIR } from "../../../../../lib/agents";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SSE endpoint that pings the client whenever the agent outbox changes.
// Client receives "ping" event → re-fetches /api/agents/messages once.
// Replaces the 2.5s poll loop in AgentsClient.
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verify(cookie);
  if (!session) return new Response("unauthenticated", { status: 401 });
  const user = findById(session.userId);
  if (!user || user.status !== "active") {
    return new Response("unauthenticated", { status: 401 });
  }

  try { fs.mkdirSync(OUTBOX_DIR, { recursive: true }); } catch { /* ignore */ }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: string) => {
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`)); }
        catch { /* closed */ }
      };
      send("ready", JSON.stringify({ ts: Date.now() }));

      // Debounce noisy filesystem events — bursts of writes during a turn
      // (running.json being rewritten 2-3x/sec by the parser) collapse into
      // one ping every 600ms.
      let timer: NodeJS.Timeout | null = null;
      const ping = () => {
        if (timer) return;
        timer = setTimeout(() => {
          timer = null;
          send("ping", String(Date.now()));
        }, 600);
      };

      let watcher: fs.FSWatcher | null = null;
      try {
        watcher = fs.watch(OUTBOX_DIR, { persistent: false }, () => ping());
      } catch { /* watcher unavailable (e.g. dir didn't exist) — fall back to keepalive only */ }

      // Heartbeat every 25s so the EventSource doesn't get reaped by proxies.
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`)); }
        catch { /* closed */ }
      }, 25_000);

      const cleanup = () => {
        clearInterval(heartbeat);
        if (timer) { clearTimeout(timer); timer = null; }
        try { watcher?.close(); } catch { /* ignore */ }
        try { controller.close(); } catch { /* already closed */ }
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
