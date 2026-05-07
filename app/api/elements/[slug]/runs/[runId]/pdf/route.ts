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
  if (!run || !run.pdfPath || !fs.existsSync(run.pdfPath)) {
    return NextResponse.json({ error: "no pdf for this run" }, { status: 404 });
  }
  const buf = fs.readFileSync(run.pdfPath);
  // `inline` (not `attachment`) so the Tauri desktop webview displays the PDF
  // inline in its built-in viewer rather than silently failing to handle the
  // download. Browsers honour the suggested filename either way; users can
  // still save via the in-page viewer's UI. Toggle to ?download=1 to force.
  const url = new URL(req.url);
  const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${disposition}; filename="${slug}-${runId}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
