import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { requireUser } from "@/lib/elements-auth";
import { slugify } from "@/lib/elements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BUILDER_SYSTEM = `You design a personal "app" — a workflow shortcut for a REPETITIVE task the user does regularly. Not a one-off question, not a research topic — a task with a stable shape they'll run again and again.

Examples that fit:
- "Weekly stock-low report" — no inputs, one Run button, outputs a PDF of low SKUs across our sites with charts
- "Draft a new product PDP" — inputs: product name, material, price; outputs Tessa-voice copy + suggested image brief
- "Customer complaint reply" — inputs: customer name, order #, issue; outputs draft reply in the right brand voice
- "Monthly ad-spend recap" — no inputs, pulls Google Ads + Meta data, outputs PDF with charts per campaign

The form fields are the bits that CHANGE each run. Everything else (the prompt, the data sources, the output format, brand voice, letterhead) is baked in once.

Output ONLY a single JSON object (no prose, no markdown fences) with this shape:
{
  "name": "Short title (max 60 chars)",
  "description": "One sentence: what repetitive task this shortcuts",
  "icon": "single emoji",
  "inputs": [
    { "name": "snake_case_field", "label": "Human label", "type": "text|textarea|select|number|file", "required": true, "placeholder": "optional", "options": ["only","for","select"], "acceptMime": "image/*,application/pdf (file-only)", "maxMB": 20 }
  ],
  "promptTemplate": "Instructions to the AI worker. Use {{snake_case_field}} to interpolate user inputs. For file inputs, {{snake_case_field}} expands to the absolute file path on disk — tell the worker to Read it. Be specific about brand voice, structure, and what the output should look like.",
  "outputFormat": "markdown" | "pdf",
  "timeoutMin": 10
}

Rules:
- Worker tools: WebSearch, WebFetch, Read, Glob, Grep, TodoWrite (read-only). It can Read uploaded files via the path interpolated from a file input.
- Inputs ONLY for things that change each run. If the task always pulls the same data, no inputs.
- timeoutMin: quick lookup 3-5, normal task 10, deep research 25-30.
- outputFormat: "pdf" when the user wants a printable/shareable document (reports, recaps, briefs, PDPs to send). "markdown" for quick text outputs.
- For PDF apps with data: tell the worker to embed Chart.js charts via fenced \`\`\`chart blocks (the renderer handles them).
- Keep inputs to 0-5 fields. Use file type for letterheads, CSVs, photos to analyse, etc.
- If the user's description is too vague (especially: what's the REPETITIVE task?), output: {"error":"Need more info: <one specific question>"}`;

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => null);
  const description = (body?.description || "").toString().trim();
  if (!description) return NextResponse.json({ error: "description required" }, { status: 400 });

  const fullPrompt = `${BUILDER_SYSTEM}\n\n---\nUser request: ${description}\n\nOutput the JSON now.`;

  try {
    const result = await runClaude(fullPrompt, 90_000);
    const cleaned = result.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    let parsed: any;
    try { parsed = JSON.parse(cleaned); }
    catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) return NextResponse.json({ error: "builder did not return JSON", raw: cleaned.slice(0, 500) }, { status: 502 });
      parsed = JSON.parse(m[0]);
    }
    if (parsed.error) return NextResponse.json({ needsMoreInfo: parsed.error });
    parsed.slug = slugify(parsed.name || "untitled");
    return NextResponse.json({ spec: parsed });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}

function runClaude(prompt: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const claudeBin = process.env.CLAUDE_BIN || "/home/nathan/.npm-global/bin/claude";
    const child = spawn(claudeBin, ["-p", "--model", "claude-sonnet-4-6", "--output-format", "text", "--permission-mode", "bypassPermissions"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "", err = "";
    const t = setTimeout(() => { try { child.kill("SIGKILL"); } catch {} reject(new Error("builder timed out")); }, timeoutMs);
    child.stdout.on("data", d => { out += d.toString(); });
    child.stderr.on("data", d => { err += d.toString(); });
    child.on("error", e => { clearTimeout(t); reject(e); });
    child.on("close", code => {
      clearTimeout(t);
      if (code === 0) resolve(out.trim());
      else reject(new Error(`claude exit ${code}: ${err.slice(0, 500)}`));
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}
