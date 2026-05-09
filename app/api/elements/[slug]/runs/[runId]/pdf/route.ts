import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { requireUser } from "@/lib/elements-auth";
import { getRun } from "@/lib/elements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string; runId: string }> }) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { slug, runId } = await ctx.params;
  const run = getRun(auth.username, runId);
  // Reject if the run doesn't exist OR if the URL slug doesn't match the run's
  // recorded slug — without this, an authed user can iterate runIds across
  // any of their other apps via a guessed slug.
  if (!run || run.slug !== slug || !run.pdfPath || !fs.existsSync(run.pdfPath)) {
    return NextResponse.json({ error: "no rendered output for this run" }, { status: 404 });
  }
  // Sanitize slug + runId before they hit Content-Disposition. Both are
  // already constrained at create time, but defense-in-depth: any CR/LF or
  // quote in the filename would enable response splitting / disposition spoof.
  const safeSlug = slug.replace(/[^\w-]/g, "_");
  const safeRunId = runId.replace(/[^\w-]/g, "_");
  const buf = fs.readFileSync(run.pdfPath);
  // Route originally served PDFs only; now also serves xlsx/pptx. Path kept
  // as /pdf for back-compat with existing run pages.
  const ext = (run.outputExt || "pdf") as "pdf" | "xlsx" | "pptx";
  const mime: Record<"pdf" | "xlsx" | "pptx", string> = {
    pdf: "application/pdf",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  const url = new URL(req.url);
  // PDF defaults to inline (Tauri webview shows it). xlsx/pptx always
  // attachment since browsers can't render Office docs inline.
  const disposition = url.searchParams.get("download") === "1" || ext !== "pdf" ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": mime[ext],
      "content-disposition": `${disposition}; filename="${safeSlug}-${safeRunId}.${ext}"`,
      "cache-control": "private, no-store",
    },
  });
}
