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

  const ext = file.type === "image/png" ? "png"
    : file.type === "image/jpeg" ? "jpg"
    : file.type === "image/svg+xml" ? "svg"
    : "webp";
  const dir = path.join(process.cwd(), "public", "branding");
  fs.mkdirSync(dir, { recursive: true });
  const outName = `logo.${ext}`;
  const outPath = path.join(dir, outName);
  // Clear other extensions so we don't end up serving a stale logo.
  for (const e of ["png", "jpg", "svg", "webp"]) {
    if (e === ext) continue;
    try { fs.unlinkSync(path.join(dir, `logo.${e}`)); } catch {}
  }
  const buf = Buffer.from(await file.arrayBuffer());
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
