import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import { checkAdminApiAuth } from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOW_PREFIX = ["/root/mission-control/", "/var/log/", "/etc/systemd/", "/etc/ssh/"];

export async function GET(req: NextRequest) {
  const fail = checkAdminApiAuth(req);
  if (fail) return fail;
  const url = new URL(req.url);
  const path = url.searchParams.get("path") || "";
  if (!path || path.includes("..")) {
    return NextResponse.json({ ok: false, error: "bad path" }, { status: 400 });
  }
  if (!ALLOW_PREFIX.some(p => path.startsWith(p))) {
    return NextResponse.json({ ok: false, error: "path not allowed" }, { status: 400 });
  }
  try {
    const s = await stat(path);
    if (s.size > 4 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: `file too large: ${s.size}` }, { status: 400 });
    }
    const content = await readFile(path, "utf8");
    return NextResponse.json({ ok: true, path, size: s.size, content });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 404 });
  }
}
