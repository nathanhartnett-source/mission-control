import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireUser } from "@/lib/elements-auth";
import { listElements, saveElement, getElement, slugify, specLetterheadDir, type ElementSpec, type ElementLetterhead } from "@/lib/elements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ elements: listElements(auth.username) });
}

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.promptTemplate) {
    return NextResponse.json({ error: "name and promptTemplate required" }, { status: 400 });
  }
  let slug = slugify(body.slug || body.name);
  if (!slug) return NextResponse.json({ error: "invalid name" }, { status: 400 });
  // If slug taken by THIS user, reject; if taken by someone else's shared, dedupe with suffix
  const existing = getElement(auth.username, slug);
  if (existing && existing.createdBy === auth.username && !body.overwrite) {
    return NextResponse.json({ error: "slug exists", slug }, { status: 409 });
  }
  if (existing && existing.createdBy !== auth.username) {
    let n = 2;
    while (getElement(auth.username, `${slug}-${n}`)) n++;
    slug = `${slug}-${n}`;
  }
  // Letterhead: if a staged temp path was uploaded, persist it under the spec's letterhead dir.
  let letterhead: ElementLetterhead | undefined;
  const lhInput = body.letterhead;
  if (lhInput?.mode === "upload" && typeof lhInput?.stagedPath === "string" && fs.existsSync(lhInput.stagedPath)) {
    const dir = specLetterheadDir(auth.username, slug);
    fs.mkdirSync(dir, { recursive: true });
    const ext = (path.extname(lhInput.stagedPath) || ".png").toLowerCase().slice(0, 8);
    const dest = path.join(dir, `letterhead${ext}`);
    fs.copyFileSync(lhInput.stagedPath, dest);
    letterhead = { mode: "upload", imagePath: dest };
  } else if (lhInput?.mode === "upload" && typeof lhInput?.imagePath === "string" && fs.existsSync(lhInput.imagePath)) {
    // Already-persisted letterhead (overwrite case)
    letterhead = { mode: "upload", imagePath: lhInput.imagePath };
  } else {
    letterhead = { mode: "none" };
  }

  const validFormats = ["markdown", "pdf", "xlsx", "pptx"] as const;
  const outputFormat: ElementSpec["outputFormat"] = validFormats.includes(body.outputFormat) ? body.outputFormat : "markdown";

  const spec: ElementSpec = {
    slug,
    name: String(body.name).slice(0, 80),
    description: String(body.description || "").slice(0, 400),
    icon: String(body.icon || "✨").slice(0, 8),
    inputs: Array.isArray(body.inputs) ? body.inputs.slice(0, 12) : [],
    promptTemplate: String(body.promptTemplate).slice(0, 8000),
    outputFormat,
    letterhead,
    timeoutMin: Math.min(30, Math.max(1, Number(body.timeoutMin) || 10)),
    shareWithOrg: !!body.shareWithOrg,
    createdAt: new Date().toISOString(),
    createdBy: auth.username,
  };
  saveElement(auth.username, spec);
  return NextResponse.json({ ok: true, spec });
}
