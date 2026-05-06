import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAGING_ROOT = "/tmp/mc-staging";
const MAX_BYTES = 20 * 1024 * 1024; // 20MB per file
const MAX_FILES = 5;
const ALLOWED_MIME_PREFIXES = ["image/", "audio/", "text/"];
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function allowedMime(mime: string): boolean {
  if (!mime) return false;
  return ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p)) || ALLOWED_MIME_TYPES.has(mime);
}

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "file";
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const all = form.getAll("files");
    if (all.length === 0) {
      return NextResponse.json({ error: "no files (form field 'files')" }, { status: 400 });
    }
    if (all.length > MAX_FILES) {
      return NextResponse.json({ error: `max ${MAX_FILES} files per upload` }, { status: 400 });
    }

    const stagingId = crypto.randomBytes(8).toString("hex");
    const dir = path.join(STAGING_ROOT, stagingId);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });

    const saved: { name: string; path: string; size: number; mime: string }[] = [];
    for (const f of all) {
      if (!(f instanceof File)) continue;
      if (f.size > MAX_BYTES) {
        return NextResponse.json({ error: `${f.name} too large (>${MAX_BYTES / 1024 / 1024}MB)` }, { status: 400 });
      }
      const mime = f.type || "application/octet-stream";
      if (!allowedMime(mime)) {
        return NextResponse.json({ error: `${f.name} has unsupported file type (${mime})` }, { status: 400 });
      }
      const out = path.join(dir, safeFilename(f.name));
      const buf = Buffer.from(await f.arrayBuffer());
      await fs.writeFile(out, buf, { mode: 0o600 });
      saved.push({ name: f.name, path: out, size: f.size, mime });
    }

    return NextResponse.json({ ok: true, staging_id: stagingId, files: saved });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
