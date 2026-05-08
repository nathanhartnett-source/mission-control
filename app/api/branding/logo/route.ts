import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  svg: "image/svg+xml",
  webp: "image/webp",
};

// Streams the latest uploaded logo from disk so newly-uploaded files are
// visible without a server restart (Next's static /public/ handling can be
// cached at startup in production builds).
export async function GET() {
  const dir = path.join(process.cwd(), "public", "branding");
  for (const ext of ["png", "jpg", "svg", "webp"]) {
    const p = path.join(dir, `logo.${ext}`);
    if (fs.existsSync(p)) {
      const buf = await fs.promises.readFile(p);
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "content-type": MIME[ext],
          "cache-control": "no-store",
        },
      });
    }
  }
  return NextResponse.json({ error: "no logo" }, { status: 404 });
}
