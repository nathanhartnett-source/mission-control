import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { checkAdminApiAuth } from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const exec = promisify(execFile);

const ALLOWED: Record<string, string[]> = {
  "systemctl": ["status", "is-active", "is-enabled", "show", "list-units", "cat"],
  "journalctl": ["-u", "-n", "--no-pager", "--since", "--until", "-r", "mission-control", "ssh", "sshd"],
  "ls": ["-la", "-l", "-a", "-h", "-R"],
  "cat": [],
  "head": ["-n", "-c"],
  "tail": ["-n", "-c", "-f"],
  "git": ["status", "log", "remote", "branch", "diff", "show", "rev-parse", "-v", "--oneline", "-n", "-5", "-10", "-20", "HEAD"],
  "ps": ["aux", "-ef", "-eo"],
  "ss": ["-tlnp", "-tlp", "-anp"],
  "df": ["-h", "-i"],
  "free": ["-h", "-m"],
  "uptime": [],
  "hostname": [],
  "whoami": [],
  "pwd": [],
  "ip": ["addr", "route", "a"],
  "uname": ["-a", "-r"],
  "node": ["--version", "-v"],
  "npm": ["--version", "-v"],
  "which": [],
  "command": ["-v"],
  "env": [],
  "ufw": ["status"],
  "fail2ban-client": ["status"],
  "iptables": ["-L", "-n", "-v"],
};

const PATH_RE = /^\/(root\/mission-control|var\/log|etc\/systemd|etc\/ssh|tmp\/mc-)/;

function safeArg(cmd: string, a: string): boolean {
  const allowed = ALLOWED[cmd];
  if (allowed === undefined) return false;
  if (allowed.includes(a)) return true;
  // numeric / pure flags ok for general tools
  if (/^[0-9]+$/.test(a)) return true;
  // for cat/head/tail/ls/journalctl/git accept whitelisted file paths
  if (PATH_RE.test(a)) return true;
  // service unit names for systemctl/journalctl
  if (/^[a-z][a-z0-9@._-]*\.(service|socket|timer|target)?$/i.test(a) && a.length < 64) return true;
  return false;
}

export async function POST(req: NextRequest) {
  const fail = checkAdminApiAuth(req);
  if (fail) return fail;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const cmd = String(body?.cmd || "");
  const args: string[] = Array.isArray(body?.args) ? body.args.map((x: any) => String(x)) : [];

  if (!ALLOWED[cmd]) {
    return NextResponse.json({ ok: false, error: `command not allowed: ${cmd}` }, { status: 400 });
  }
  for (const a of args) {
    if (!safeArg(cmd, a)) {
      return NextResponse.json({ ok: false, error: `argument not allowed: ${a}` }, { status: 400 });
    }
  }

  try {
    const { stdout, stderr } = await exec(cmd, args, {
      timeout: 30_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return NextResponse.json({ ok: true, stdout, stderr });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e.message,
      stdout: e.stdout || "",
      stderr: e.stderr || "",
      code: e.code,
    });
  }
}
