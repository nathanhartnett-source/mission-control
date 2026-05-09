import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { readInstallConfig, writeInstallConfig } from "@/lib/install-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function gateAdmin(req: NextRequest) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = findById(session.userId);
  if (!user || !user.isAdmin) return null;
  return user;
}

export async function GET(req: NextRequest) {
  if (!gateAdmin(req)) return NextResponse.json({ error: "admin only" }, { status: 403 });
  return NextResponse.json({ ok: true, install: readInstallConfig() });
}

export async function PUT(req: NextRequest) {
  if (!gateAdmin(req)) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const patch: { wikiRoot?: string; timezone?: string } = {};

  if (typeof body?.wikiRoot === "string" && body.wikiRoot.trim()) {
    const resolved = path.resolve(body.wikiRoot.trim());
    const forbidden = ["/", "/etc", "/usr", "/bin", "/var", "/root", "/home"];
    if (!path.isAbsolute(resolved) || forbidden.includes(resolved)) {
      return NextResponse.json({ error: `wikiRoot must be an absolute path and not a system dir` }, { status: 400 });
    }
    if (!fs.existsSync(resolved)) {
      try { fs.mkdirSync(resolved, { recursive: true }); }
      catch (e) { return NextResponse.json({ error: `failed to create dir: ${(e as Error).message}` }, { status: 400 }); }
    }
    patch.wikiRoot = resolved;
  }
  if (typeof body?.timezone === "string" && body.timezone.trim()) {
    const tz = body.timezone.trim();
    // Sanity-check: Intl will throw if tz is unknown.
    try { new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date()); }
    catch { return NextResponse.json({ error: `unknown timezone: ${tz}` }, { status: 400 }); }
    patch.timezone = tz;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no valid fields to update (wikiRoot or timezone)" }, { status: 400 });
  }
  const next = writeInstallConfig(patch);
  return NextResponse.json({ ok: true, install: next });
}
