import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { verifyAdminApiToken } from "@/lib/admin-api-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * Pulls latest from origin/main, builds, and restarts the systemd unit.
 * Token-auth only (no session cookie). Used by `mc-remote <host> deploy`.
 *
 * Streams nothing — returns the full combined stdout/stderr at the end.
 * For self-restart safety, the actual restart is detached so the response
 * has time to flush before systemd kills this process.
 */
export async function POST(req: NextRequest) {
  if (!verifyAdminApiToken(bearer(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cwd = process.env.MC_HOME || process.cwd();
  const script = `set -euo pipefail
cd '${cwd.replace(/'/g, "'\\''")}'
echo "==> git pull"
git pull --ff-only
echo "==> npm install"
npm install --no-audit --no-fund
echo "==> npm run build"
npm run build
echo "==> queuing detached restart"
( sleep 2 && systemctl restart mission-control ) >/dev/null 2>&1 &
disown
echo "==> deploy ok (restart queued)"`;

  return new Promise<NextResponse>((resolve) => {
    const child = spawn("bash", ["-c", script], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.stderr.on("data", (d) => { err += d.toString(); });
    child.on("close", (code) => {
      const tail = (s: string, n = 8000) => s.length > n ? "…" + s.slice(-n) : s;
      resolve(NextResponse.json({
        ok: code === 0,
        exitCode: code,
        stdout: tail(out),
        stderr: tail(err),
      }, { status: code === 0 ? 200 : 500 }));
    });
    child.on("error", (e) => {
      resolve(NextResponse.json({ ok: false, error: e.message }, { status: 500 }));
    });
  });
}
