import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Wiki content root. Per-install via MC_WIKI_ROOT env var (set in the systemd
// unit). Falls back to MC_HOME/wiki for clean installs, then /home/nathan/wiki
// for the messy MC dev box. Without this gate the demo + OBT installs would
// leak Nathan's personal wiki content into client-facing dashboards.
const WIKI_ROOT =
  process.env.MC_WIKI_ROOT ||
  (process.env.MC_HOME ? path.join(process.env.MC_HOME, "wiki") : "/home/nathan/wiki");

function safeWikiPath(input: string | null) {
  if (!input) return null;
  const normalized = path.normalize(input).replace(/^([/\\])+/, "");
  if (!normalized.endsWith(".md")) return null;
  if (normalized.split(path.sep).includes("..")) return null;

  const absolute = path.resolve(WIKI_ROOT, normalized);
  const root = path.resolve(WIKI_ROOT);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return null;
  return absolute;
}

export async function GET(req: NextRequest) {
  const filePath = safeWikiPath(req.nextUrl.searchParams.get("path"));
  if (!filePath) {
    return NextResponse.json({ error: "Invalid wiki path" }, { status: 400 });
  }

  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 404 });
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ error: "Wiki file not found" }, { status: 404 });
  }
}
