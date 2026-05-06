import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "personal");

// --- Settings helpers ---

const VALID_SETTINGS_KEYS = ["waterGoalL", "calorieGoal", "proteinGoal", "fatGoal", "carbGoal"];

function settingsPath(person: string) {
  return path.join(DATA_DIR, `${person}-settings.json`);
}

function readSettings(person: string): Record<string, number> {
  const fp = settingsPath(person);
  if (!fs.existsSync(fp)) return {};
  return JSON.parse(fs.readFileSync(fp, "utf-8"));
}

function writeSettings(person: string, data: Record<string, number>) {
  fs.writeFileSync(settingsPath(person), JSON.stringify(data, null, 2) + "\n");
}

// --- Module registry helpers (inline to avoid cross-route imports) ---

interface ModuleEntry {
  id: string;
  type: "counter" | "checklist" | "number_log" | "text_note" | "toggle";
  subtype?: string;
  label: string;
  emoji: string;
  unit?: string;
  goal?: number;
  items?: string[];
  addedAt: string;
  dataFile: string;
  person: "nathan" | "tessa" | "karl" | "tracy";
}

function registryPath(person: string) {
  return path.join(DATA_DIR, `${person}-modules.json`);
}

function readRegistry(person: string): { modules: ModuleEntry[] } {
  const fp = registryPath(person);
  if (!fs.existsSync(fp)) return { modules: [] };
  return JSON.parse(fs.readFileSync(fp, "utf-8"));
}

function writeRegistry(person: string, data: { modules: ModuleEntry[] }) {
  fs.writeFileSync(registryPath(person), JSON.stringify(data, null, 2) + "\n");
}

function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// --- Gemini function calling tools ---

const tools = [
  {
    functionDeclarations: [
      {
        name: "add_module",
        description: "Add a new tracking module/bubble to the dashboard",
        parameters: {
          type: "object",
          properties: {
            label: { type: "string", description: "Display name, e.g. Coffee Intake" },
            type: {
              type: "string",
              enum: ["counter", "checklist", "number_log", "text_note", "toggle"],
              description: "Type of tracking module",
            },
            emoji: { type: "string", description: "A relevant emoji" },
            unit: { type: "string", description: "Unit of measurement if applicable" },
            goal: { type: "number", description: "Daily goal if applicable" },
            items: {
              type: "array",
              items: { type: "string" },
              description: "For checklist type — the items to check off",
            },
          },
          required: ["label", "type", "emoji"],
        },
      },
      {
        name: "remove_module",
        description: "Remove a tracking module from the dashboard",
        parameters: {
          type: "object",
          properties: {
            label: { type: "string", description: "The label of the module to remove" },
          },
          required: ["label"],
        },
      },
      {
        name: "list_modules",
        description: "List the current active modules on the dashboard",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "update_settings",
        description: "Update a built-in tracker goal or setting, e.g. change the daily water goal, calorie goal, protein target",
        parameters: {
          type: "object",
          properties: {
            setting: { type: "string", description: "The setting key to update: waterGoalL, calorieGoal, proteinGoal, fatGoal, carbGoal" },
            value: { type: "number", description: "The new value" },
          },
          required: ["setting", "value"],
        },
      },
      {
        name: "update_color",
        description: "Change the accent colour of one or all dashboard bubbles/modules. Use this when the user says things like make my water bubble blue, change fitness to green, make everything purple.",
        parameters: {
          type: "object",
          properties: {
            target: {
              type: "string",
              description: 'Module name/id to change, or "all" for global theme. Built-in modules: water, fitness, nutrition. Dynamic modules use their label (lowercase, hyphenated).',
            },
            color: {
              type: "string",
              description: 'CSS colour value. Named colours accepted: blue, purple, green, red, orange, pink, yellow, teal, indigo, rose, cyan, reset (removes custom colour).',
            },
          },
          required: ["target", "color"],
        },
      },
      {
        name: "update_module",
        description: "Update an existing dynamic module — change its label, goal, unit, emoji, or items",
        parameters: {
          type: "object",
          properties: {
            id_or_label: { type: "string", description: "The id or label of the module to update" },
            label: { type: "string" },
            emoji: { type: "string" },
            unit: { type: "string" },
            goal: { type: "number" },
            items: { type: "array", items: { type: "string" } },
          },
          required: ["id_or_label"],
        },
      },
    ],
  },
];

// --- Gemini native endpoint helper ---

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

async function callGemini(
  contents: GeminiContent[],
  systemInstruction: string,
  signal: AbortSignal,
) {
  const res = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      tools,
      systemInstruction: { parts: [{ text: systemInstruction }] },
    }),
    signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini ${res.status}: ${text}`);
  }
  return res.json();
}

// --- Execute a function call ---

function executeFunction(
  name: string,
  args: Record<string, unknown>,
  person: string,
): { result: Record<string, unknown>; moduleName?: string; functionCalled?: string } {
  if (name === "add_module") {
    const slug = slugify(args.label as string);
    const id = `${slug}-${Date.now().toString(36)}`;
    const dataFile = `data/personal/${person}-${slug}.json`;
    const entry: ModuleEntry = {
      id,
      type: args.type as ModuleEntry["type"],
      label: args.label as string,
      emoji: args.emoji as string,
      unit: args.unit as string | undefined,
      goal: args.goal as number | undefined,
      items: args.items as string[] | undefined,
      addedAt: new Date().toISOString(),
      dataFile,
      person: person as "nathan" | "tessa" | "karl" | "tracy",
    };
    const registry = readRegistry(person);
    registry.modules.push(entry);
    writeRegistry(person, registry);
    // Create empty data file
    const dataFilePath = path.join(process.cwd(), dataFile);
    if (!fs.existsSync(dataFilePath)) {
      fs.writeFileSync(dataFilePath, JSON.stringify({ entries: [] }, null, 2) + "\n");
    }
    return {
      result: { success: true, module: entry },
      moduleName: entry.label,
      functionCalled: "add_module",
    };
  }

  if (name === "remove_module") {
    const label = (args.label as string).toLowerCase();
    const registry = readRegistry(person);
    const match = registry.modules.find((m) => m.label.toLowerCase() === label);
    if (!match) {
      return { result: { success: false, error: `No module found with label "${args.label}"` } };
    }
    registry.modules = registry.modules.filter((m) => m.id !== match.id);
    writeRegistry(person, registry);
    return {
      result: { success: true, removedLabel: match.label },
      moduleName: match.label,
      functionCalled: "remove_module",
    };
  }

  if (name === "list_modules") {
    const registry = readRegistry(person);
    const summary = registry.modules.map((m) => `${m.emoji} ${m.label} (${m.type})`).join(", ");
    return {
      result: {
        modules: registry.modules.map((m) => ({
          label: m.label,
          type: m.type,
          emoji: m.emoji,
          unit: m.unit,
          goal: m.goal,
        })),
        summary: summary || "No modules yet.",
      },
    };
  }

  if (name === "update_settings") {
    const setting = args.setting as string;
    const value = args.value as number;
    if (!VALID_SETTINGS_KEYS.includes(setting)) {
      return { result: { success: false, error: `Invalid setting key: ${setting}` } };
    }
    const current = readSettings(person);
    current[setting] = value;
    writeSettings(person, current);
    return {
      result: { success: true, updated: setting, newValue: value },
      moduleName: `${setting} updated`,
      functionCalled: "update_settings",
    };
  }

  if (name === "update_color") {
    const { target, color } = args as { target: string; color: string };
    const colorMap: Record<string, string> = {
      blue: "#3b82f6", purple: "#a855f7", green: "#22c55e", red: "#ef4444",
      orange: "#f97316", pink: "#ec4899", yellow: "#eab308", teal: "#14b8a6",
      indigo: "#6366f1", rose: "#f43f5e", cyan: "#06b6d4",
    };
    const resolvedColor = color === "reset" ? null : (colorMap[color.toLowerCase()] ?? color);
    const settingsKey = target === "all" ? "global" : target.toLowerCase().replace(/\s+/g, "-");

    const sp = settingsPath(person);
    const settings = JSON.parse(fs.readFileSync(sp, "utf-8"));
    if (!settings.moduleColors) settings.moduleColors = {};
    settings.moduleColors[settingsKey] = resolvedColor;
    fs.writeFileSync(sp, JSON.stringify(settings, null, 2) + "\n");

    return {
      result: { success: true, target: settingsKey, color: resolvedColor },
      moduleName: "colors updated",
      functionCalled: "update_color",
    };
  }

  if (name === "update_module") {
    const idOrLabel = (args.id_or_label as string).toLowerCase();
    const registry = readRegistry(person);
    const match = registry.modules.find(
      (m) => m.id.toLowerCase() === idOrLabel || m.label.toLowerCase() === idOrLabel,
    );
    if (!match) {
      return { result: { success: false, error: `No module found matching "${args.id_or_label}"` } };
    }
    if (args.label !== undefined) match.label = args.label as string;
    if (args.emoji !== undefined) match.emoji = args.emoji as string;
    if (args.unit !== undefined) match.unit = args.unit as string;
    if (args.goal !== undefined) match.goal = args.goal as number;
    if (args.items !== undefined) match.items = args.items as string[];
    writeRegistry(person, registry);
    return {
      result: { success: true, module: match },
      moduleName: match.label,
      functionCalled: "update_module",
    };
  }

  return { result: { error: `Unknown function: ${name}` } };
}

// --- Main handler ---

export async function POST(req: NextRequest) {
  try {
    const { message, person, history, settings, modules } = await req.json();

    // Verify chat token
    const token = req.headers.get("x-chat-token");
    const secret = process.env.CHAT_TOKEN_SECRET;
    if (!token || !secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Brisbane" });
    const expected = createHmac("sha256", secret).update(`${person}:${today}`).digest("hex");
    if (token !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!message || !person) {
      return NextResponse.json({ error: "message and person are required" }, { status: 400 });
    }

    const moduleSummary = modules?.length > 0
      ? modules.map((m: ModuleEntry) => `- ${m.emoji} ${m.label} (type: ${m.type}${m.goal ? `, goal: ${m.goal}${m.unit ? " " + m.unit : ""}` : ""})`).join("\n")
      : "None yet";

    const hasBuiltins = person === "nathan" || person === "tessa";
    const builtinSection = hasBuiltins
      ? `Built-in trackers (always present on ${person}'s dashboard, do NOT add these as dynamic modules): Water Intake, Fitness Regimen, Nutrition/Macros.
Current built-in tracker settings:
- Water goal: ${settings?.waterGoalL ?? 2.5}L per day
- Daily calorie goal: ${settings?.calorieGoal ?? 2000} kcal
- Protein goal: ${settings?.proteinGoal ?? 150}g
- Fat goal: ${settings?.fatGoal ?? 80}g
- Carb goal: ${settings?.carbGoal ?? 200}g
Current colour theme: global=${settings?.moduleColors?.global ?? "default (green)"}, water=${settings?.moduleColors?.water ?? "default"}, fitness=${settings?.moduleColors?.fitness ?? "default"}, nutrition=${settings?.moduleColors?.nutrition ?? "default"}.`
      : `${person}'s dashboard has NO built-in trackers. Everything must be added as a dynamic module. Do NOT assume any tracker already exists.`;

    const systemPrompt = `You are Ash, a personal assistant helping ${person} build and manage their dashboard.

Current dynamic modules (already set up on ${person}'s dashboard):
${moduleSummary}

${builtinSection}

Help ${person} track what matters to them. Use the available functions to add, remove, or update modules. If they ask for something that's already there, tell them it exists. If they ask for something that doesn't exist yet, add it. Never assume a module exists unless it appears in the list above.`;

    // Build conversation history in Gemini native format
    const contents: GeminiContent[] = [];
    if (history && Array.isArray(history)) {
      const recent = history.slice(-10);
      for (const m of recent) {
        contents.push({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }],
        });
      }
    }
    contents.push({ role: "user", parts: [{ text: message }] });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    let data;
    let functionCalled: string | undefined;
    let moduleName: string | undefined;

    try {
      // First Gemini call
      data = await callGemini(contents, systemPrompt, controller.signal);

      const candidate = data.candidates?.[0];
      const parts: GeminiPart[] = candidate?.content?.parts || [];

      // Check if Gemini wants to call a function
      const fnCall = parts.find((p: GeminiPart) => p.functionCall);
      if (fnCall?.functionCall) {
        const { name, args } = fnCall.functionCall;
        const execResult = executeFunction(name, args || {}, person);
        functionCalled = execResult.functionCalled;
        moduleName = execResult.moduleName;

        // Send function result back to Gemini for final text response
        contents.push({
          role: "model",
          parts: [{ functionCall: { name, args: args || {} } }],
        });
        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name,
                response: execResult.result,
              },
            },
          ],
        });

        data = await callGemini(contents, systemPrompt, controller.signal);
      }
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof DOMException && err.name === "AbortError") {
        return NextResponse.json({ error: "Ash is thinking — try again in a moment" }, { status: 504 });
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    const finalParts: GeminiPart[] = data.candidates?.[0]?.content?.parts || [];
    const reply = finalParts.map((p: GeminiPart) => p.text || "").join("").trim() || "No response from model.";

    return NextResponse.json({ reply, functionCalled, moduleName });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
