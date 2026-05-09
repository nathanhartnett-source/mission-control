import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/elements-auth";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { spawn } from "child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAGING = path.join(os.tmpdir(), "mc-tts");
const ASH_TTS = "/home/nathan/bin/ash-tts";
const DEFAULT_VOICE = "en-GB-SoniaNeural";  // matches the ash-tts default per memory

function synthesize(text: string, outPath: string, voice: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ASH_TTS, ["-o", outPath, "-v", voice, text], { env: process.env });
    let err = "";
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ash-tts exit ${code}: ${err.slice(0, 400)}`));
    });
    proc.on("error", reject);
    setTimeout(() => { proc.kill("SIGKILL"); reject(new Error("tts timeout (45s)")); }, 45_000);
  });
}

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await req.json()) as { text?: string; voice?: string };
    const text = (body.text || "").trim();
    if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
    if (text.length > 4000) return NextResponse.json({ error: "text too long (>4000 chars)" }, { status: 400 });

    const voice = body.voice || DEFAULT_VOICE;
    await fs.mkdir(STAGING, { recursive: true });
    const id = crypto.randomBytes(6).toString("hex");
    const outPath = path.join(STAGING, `tts-${id}.mp3`);

    try {
      await synthesize(text, outPath, voice);
      const buf = await fs.readFile(outPath);
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "content-type": "audio/mpeg",
          "cache-control": "no-store",
          "content-length": String(buf.length),
        },
      });
    } finally {
      fs.unlink(outPath).catch(() => {});
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
