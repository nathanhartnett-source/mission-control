import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { readBranding, writeBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp"]);
const MAX_BYTES = 1024 * 1024; // 1MB

export async function POST(req: NextRequest) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const user = findById(session.userId);
  if (!user || !user.isAdmin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "missing file" }, { status: 400 });
  if (!ALLOWED_MIME.has(file.type)) return NextResponse.json({ error: `unsupported type ${file.type}` }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file too large (>1MB)" }, { status: 400 });

  const dir = path.join(process.cwd(), "public", "branding");
  fs.mkdirSync(dir, { recursive: true });
  let buf = Buffer.from(await file.arrayBuffer());
  // For raster PNG/JPG, strip near-white pixels to transparent so logos
  // exported as RGB (e.g. ChatGPT's image generator) display cleanly on
  // any sidebar background. SVG/WebP pass through unchanged.
  let finalExt: "png" | "svg" | "webp" = "png";
  if (file.type === "image/svg+xml") finalExt = "svg";
  else if (file.type === "image/webp") finalExt = "webp";
  if (file.type === "image/png" || file.type === "image/jpeg") {
    try {
      const sharp = (await import("sharp")).default;
      const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const px = Buffer.from(data);
      for (let i = 0; i < px.length; i += 4) {
        if (px[i] >= 245 && px[i + 1] >= 245 && px[i + 2] >= 245) px[i + 3] = 0;
      }
      const out = await sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } })
        .png({ compressionLevel: 9 })
        .toBuffer();
      buf = Buffer.from(out);
    } catch (e) {
      console.warn("[logo] white-strip failed, saving as-is:", (e as Error).message);
    }
  }
  // Clear other extensions so we don't end up serving a stale logo.
  for (const e of ["png", "jpg", "svg", "webp"]) {
    if (e === finalExt) continue;
    try { fs.unlinkSync(path.join(dir, `logo.${e}`)); } catch {}
  }
  const outPath = path.join(dir, `logo.${finalExt}`);
  fs.writeFileSync(outPath, buf);

  const cacheBust = Date.now();
  const logoPath = `/api/branding/logo?v=${cacheBust}`;
  const next = writeBranding({ logoPath });
  return NextResponse.json({ ok: true, branding: next });
}

export async function DELETE(req: NextRequest) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const user = findById(session.userId);
  if (!user || !user.isAdmin) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const dir = path.join(process.cwd(), "public", "branding");
  for (const e of ["png", "jpg", "svg", "webp"]) {
    try { fs.unlinkSync(path.join(dir, `logo.${e}`)); } catch {}
  }
  const next = writeBranding({ logoPath: null });
  return NextResponse.json({ ok: true, branding: next });
  // Note: readBranding fallback returns DEFAULT — caller still gets logoPath:null.
  void readBranding;
}
