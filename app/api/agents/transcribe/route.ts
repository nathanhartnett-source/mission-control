import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAGING = path.join(os.tmpdir(), "mc-stt");
const ASH_STT = "/home/nathan/bin/ash-stt";

function transcribe(audioPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ASH_STT, [audioPath], { env: process.env });
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => { out += d.toString(); });
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(`ash-stt exit ${code}: ${err.trim().slice(0, 400)}`));
    });
    proc.on("error", reject);
    setTimeout(() => { proc.kill("SIGKILL"); reject(new Error("transcribe timeout (60s)")); }, 60_000);
  });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "audio file required (form field 'audio')" }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "audio too large (>25MB)" }, { status: 400 });
    }

    await fs.mkdir(STAGING, { recursive: true, mode: 0o700 });
    // Pick a sensible extension from the mime type
    const mime = file.type || "audio/webm";
    if (!mime.startsWith("audio/") && !mime.includes("webm") && !mime.includes("ogg")) {
      return NextResponse.json({ error: `unsupported audio type (${mime})` }, { status: 400 });
    }
    const ext = mime.includes("ogg") ? "ogg"
      : mime.includes("wav") ? "wav"
      : mime.includes("mp3") || mime.includes("mpeg") ? "mp3"
      : mime.includes("m4a") || mime.includes("mp4") ? "m4a"
      : "webm";
    const tmpPath = path.join(STAGING, `stt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tmpPath, buf, { mode: 0o600 });

    let text = "";
    try {
      text = await transcribe(tmpPath);
    } finally {
      // Best-effort cleanup
      fs.unlink(tmpPath).catch(() => {});
    }
    return NextResponse.json({ ok: true, text });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
