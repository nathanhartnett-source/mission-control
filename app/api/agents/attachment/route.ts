import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/elements-auth";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAGING_ROOT = "/tmp/mc-staging";
// Additional roots that agents (mostly Ash via ash-image) may write outputs to
// and link to in their replies. Single-user local server behind auth, so a
// permissive whitelist is fine — we still block path traversal via path.resolve.
const ALLOWED_ROOTS = [
  STAGING_ROOT,
  "/tmp",
  "/home/nathan/wiki",
  "/home/nathan/social-videos",
  "/home/nathan/.hermes",
  "/home/nathan/Downloads",
  "/home/nathan/legacy-workspace/mission-control/public",
];

// Image-only extensions allowed outside the staging root. Keeps the wider
// whitelist from being a generic file-leak surface.
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".json": "application/json",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
};

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const raw = req.nextUrl.searchParams.get("path") || "";
  const resolved = path.resolve(raw);
  const ext = path.extname(resolved).toLowerCase();
  // Inside STAGING_ROOT: anything goes (existing contract).
  // Outside STAGING_ROOT but under another allowed root: image extensions only.
  const inStaging = resolved.startsWith(STAGING_ROOT + path.sep);
  const inOtherRoot = ALLOWED_ROOTS.some(
    (r) => r !== STAGING_ROOT && (resolved === r || resolved.startsWith(r + path.sep)),
  );
  const allowed = inStaging || (inOtherRoot && IMAGE_EXTS.has(ext));
  if (!allowed) {
    return NextResponse.json({ error: "forbidden path" }, { status: 403 });
  }
  let buf: Buffer;
  try {
    buf = await fs.readFile(resolved);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const mime = MIME_BY_EXT[ext] || "application/octet-stream";
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "content-type": mime,
      "cache-control": "private, max-age=3600",
    },
  });
}
