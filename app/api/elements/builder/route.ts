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
  "outputFormat": "markdown" | "pdf" | "xlsx" | "pptx",
  "timeoutMin": 10
}

Rules:
- Worker tools: WebSearch, WebFetch, Read, Glob, Grep, TodoWrite (read-only). It can Read uploaded files via the path interpolated from a file input.
- Inputs ONLY for things that change each run. If the task always pulls the same data, no inputs.
- timeoutMin: quick lookup 3-5, normal task 10, deep research 25-30.
- outputFormat:
  - "markdown" for quick text answers / drafts the user just wants to read or copy.
  - "pdf" for printable/shareable documents (reports, recaps, briefs, customer-facing PDPs). Worker embeds Chart.js charts via \`\`\`chart blocks.
  - "xlsx" when the user wants a SPREADSHEET with rows/columns/multiple tabs (stock lists, sales exports, contact lists, schedules to filter & sort). Worker emits \`\`\`sheet:TabName fenced CSV blocks per tab.
  - "pptx" when the user wants a SLIDE DECK to present (board updates, kickoff decks, training intros). Worker emits \`\`\`slide JSON-per-slide blocks.
  Pick xlsx/pptx ONLY when the user genuinely wants that format — when in doubt prefer pdf.
- Keep inputs to 0-5 fields. Use file type for letterheads, CSVs, photos to analyse, etc.
- If the user's description is too vague (especially: what's the REPETITIVE task?), output: {"error":"Need more info: <one specific question>"}`;

const EDIT_SYSTEM_SUFFIX = `

You are EDITING an existing app rather than creating a new one. The user will provide:
1. The current spec (JSON).
2. A change request in plain English (e.g. "make the depth select default to Standard", "add a field for budget", "change the output to PDF").

Output the FULL updated spec JSON in the same shape (name, description, icon, inputs[], promptTemplate, outputFormat, timeoutMin) — not a diff. Preserve fields the user didn't ask to change.

What you CAN'T change via this edit flow:
- Scheduling/automation (managed separately via Settings → Crons; tell the user politely if they ask).
- Worker capabilities (still read-only: WebSearch, WebFetch, Read, Glob, Grep). Can't add Bash/Write/code execution.
- Image generation (parked until per-tenant API keys are wired).

If the user's edit request requires one of those, output {"error":"Need more info: <one specific note explaining what's not possible and what alternative might work>"}.`;

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => null);
  const description = (body?.description || "").toString().trim();
  if (!description) return NextResponse.json({ error: "description required" }, { status: 400 });

  const existingSpec = body?.existingSpec && typeof body.existingSpec === "object" ? body.existingSpec : null;
  const isEdit = !!existingSpec;
  const sys = isEdit ? `${BUILDER_SYSTEM}${EDIT_SYSTEM_SUFFIX}` : BUILDER_SYSTEM;
  const fullPrompt = isEdit
    ? `${sys}\n\n---\nCURRENT SPEC:\n${JSON.stringify(existingSpec, null, 2)}\n\nCHANGE REQUEST: ${description}\n\nOutput the full updated JSON now.`
    : `${sys}\n\n---\nUser request: ${description}\n\nOutput the JSON now.`;

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

function findClaudeBin(): string {
  const fs = require("fs");
  if (process.env.MC_CLAUDE_BIN && fs.existsSync(process.env.MC_CLAUDE_BIN)) return process.env.MC_CLAUDE_BIN;
  if (process.env.CLAUDE_BIN && fs.existsSync(process.env.CLAUDE_BIN)) return process.env.CLAUDE_BIN;
  for (const c of ["/home/nathan/.npm-global/bin/claude", "/root/.npm-global/bin/claude", "/usr/local/bin/claude", "/usr/bin/claude"]) {
    if (fs.existsSync(c)) return c;
  }
  return "claude";
}

function runClaude(prompt: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const claudeBin = findClaudeBin();
    const isRoot = process.getuid?.() === 0;
    const args = ["-p", "--model", "claude-sonnet-4-6", "--output-format", "text"];
    if (!isRoot) args.push("--permission-mode", "bypassPermissions");
    const child = spawn(claudeBin, args, {
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
