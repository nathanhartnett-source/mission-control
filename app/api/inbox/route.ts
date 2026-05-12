import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById, findByUsername } from "@/lib/users";
import { listMessages, postMessage, unreadCount, markAllRead, type InboxMessage } from "@/lib/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/inbox[?unread=1][&limit=50] — current user's messages
export async function GET(req: NextRequest) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const user = findById(session.userId);
  if (!user || user.status !== "active") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "1";
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10) || 50));
  const messages = listMessages(user.username, { unreadOnly, limit });
  return NextResponse.json({ messages, unread: unreadCount(user.username) });
}

// POST /api/inbox — push a message to a user's inbox.
//   - Authed as admin with body { to: <username>, ... }
//   - Or from same-box (loopback) without auth — for the mc-inbox CLI
function isLoopback(req: NextRequest): boolean {
  const h = req.headers;
  const fwd = (h.get("x-forwarded-for") || "").split(",")[0].trim();
  if (fwd && fwd !== "127.0.0.1" && fwd !== "::1") return false;
  const host = h.get("host") || "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
}

export async function POST(req: NextRequest) {
  let body: Partial<InboxMessage> & { to?: string } = {};
  try { body = await req.json(); } catch {}

  let to: string | null = null;

  // Path 1: authenticated user can post to themselves OR (if admin) to anyone.
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    const user = findById(session.userId);
    if (user && user.status === "active") {
      if (body.to && user.isAdmin) to = body.to.toLowerCase();
      else to = user.username;
    }
  }

  // Path 2: same-box CLI without auth — must specify `to`.
  if (!to && isLoopback(req)) {
    to = (body.to || "").toString().toLowerCase();
  }

  if (!to) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // Validate recipient exists
  if (!findByUsername(to)) return NextResponse.json({ error: "no such user" }, { status: 404 });

  const subject = String(body.subject || "").slice(0, 200).trim();
  if (!subject) return NextResponse.json({ error: "subject required" }, { status: 400 });

  const msg = postMessage(to, {
    from: String(body.from || "Agent").slice(0, 80),
    subject,
    body: String(body.body || "").slice(0, 8000),
    href: body.href ? String(body.href).slice(0, 500) : undefined,
    level: (["info", "warn", "error", "success"] as const).includes(body.level as "info") ? body.level : "info",
  });
  return NextResponse.json({ ok: true, message: msg });
}

// PUT /api/inbox  — { action: "markAllRead" }
export async function PUT(req: NextRequest) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const user = findById(session.userId);
  if (!user || user.status !== "active") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body?.action === "markAllRead") {
    const n = markAllRead(user.username);
    return NextResponse.json({ ok: true, markedRead: n });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
