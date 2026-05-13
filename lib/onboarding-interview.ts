// Onboarding interview engine.
//
// Drives a multi-turn, Opus-led conversation that gathers the seven data
// pillars Nathan specced:
//   1. identity — who they are, what they do
//   2. friction — where work gets messy / forgotten / scattered
//   3. tools — where important info currently lives
//   4. dashboard — what should appear first on their home screen
//   5. comms — tone / formality / emoji / channel preferences
//   6. focus — where the agent should help initially
//   7. principles — boundaries, careful-with topics, must-do behaviours
//
// The Opus call receives the entire transcript so far + a system prompt
// describing the pillar model and what "covered enough" looks like.
// Opus returns either the next question (with metadata about which pillar
// it's targeting and which pillars are now complete) or a final compiled
// plan that the save endpoint writes to disk.

export type Pillar =
  | "identity"
  | "friction"
  | "tools"
  | "dashboard"
  | "comms"
  | "focus"
  | "principles";

export const PILLARS: Pillar[] = [
  "identity", "friction", "tools", "dashboard", "comms", "focus", "principles",
];

export type InterviewMessage = { role: "user" | "assistant"; text: string };

export type CompiledPlan = {
  agentName: string;
  identity: { role: string; context: string; about: string };
  friction: { painPoints: string[]; topConcern: string };
  tools: { primary: string[]; notes: string };
  dashboard: { wantsBentos: string[]; pinnedApps: string[]; notes: string };
  comms: {
    tone: "concise" | "warm" | "dry-wit" | "professional" | "playful";
    formality: "casual" | "balanced" | "formal";
    emoji: boolean;
    notes: string;
  };
  focus: { initialGoals: string[]; firstWeek: string };
  principles: { boundaries: string[]; careful: string[]; mustDo: string[] };
  summary: string;
};

export const SYSTEM_PROMPT = `You are a warm, conversational concierge welcoming a new user into their AI OS dashboard. This is NOT a survey — it's a guided setup. You will interview the user across seven pillars to understand who they are and how the AI OS should be tailored to them.

The seven pillars:
1. **identity** — who they are, what they do, what their work looks like day-to-day
2. **friction** — where their work gets messy, forgotten, scattered. What annoys them. What slips through cracks.
3. **tools** — where important information currently lives (Slack, email, Notion, spreadsheets, whatever)
4. **dashboard** — what they want to see when they open the AI OS each morning
5. **comms** — how the agent should talk to them (tone, formality, emojis, how blunt or warm)
6. **focus** — where the agent should help in the first week
7. **principles** — what the agent must be careful about, things to avoid, boundaries

Rules for the interview:
- Ask ONE question at a time. Never bullet-list multiple questions.
- Open warmly. Your first message must include a short welcome (no more than two sentences) and the FIRST question targeting the **identity** pillar.
- Drill down WHEN HELPFUL but cap it. Never spend more than 3 user turns on a single pillar. After 2 thin answers, accept what you have and move on with a friendly "no worries, we can come back to this later".
- If the user replies with "skip", "move on", "next", "pass", "dunno", "not sure", or anything similar — IMMEDIATELY mark the current pillar complete and move to the next. Do not ask the same question rephrased.
- Don't be a robot. Acknowledge what they said in one short clause before the next question.
- Move pillar-by-pillar in order. Don't jump around.
- When you have a pillar covered enough to write a useful memory file (or the user has signalled they don't want to engage with it), mark it complete and move to the next.
- After all seven are processed, return a final compiled plan as JSON instead of a question. For pillars the user skipped or barely engaged with, use sensible empty arrays + short summary phrases like "user didn't specify — re-prompt later" rather than inventing detail.

Output format:
EVERY response must be a single JSON object on one line, no markdown fences, no surrounding prose:
{ "type": "question", "text": "<your reply + next question>", "currentPillar": "<one of the seven>", "pillarsComplete": ["<list of pillars done so far>"] }

When all seven pillars are covered, return:
{ "type": "done", "plan": { ...compiled plan... } }

The compiled plan schema:
{
  "agentName": "<short name they chose, default 'Hazel' if they didn't pick one>",
  "identity": { "role": "<one-line>", "context": "<one-line>", "about": "<2-4 sentences synthesising who they are>" },
  "friction": { "painPoints": ["<short bullet>", ...], "topConcern": "<one-sentence summary>" },
  "tools": { "primary": ["<tool>", ...], "notes": "<one or two sentences>" },
  "dashboard": { "wantsBentos": ["<suggested bento prompt>", ...], "pinnedApps": ["<app slug or null>", ...], "notes": "<one or two sentences>" },
  "comms": { "tone": "<concise|warm|dry-wit|professional|playful>", "formality": "<casual|balanced|formal>", "emoji": true|false, "notes": "<one sentence>" },
  "focus": { "initialGoals": ["<short bullet>", ...], "firstWeek": "<one to two sentences>" },
  "principles": { "boundaries": ["<bullet>", ...], "careful": ["<bullet>", ...], "mustDo": ["<bullet>", ...] },
  "summary": "<3-5 sentence holistic profile the agent will read every turn>"
}

Be specific in the compiled plan. Don't put generic platitudes — synthesise what they actually said in concrete terms. Bullets should be 5-15 words each.`;

export function buildInterviewMessages(transcript: InterviewMessage[]): string {
  // We pass the whole transcript as a single rendered prompt the spawned
  // claude -p receives via stdin (no chat-history support there). The
  // assistant turn we want it to produce will be the next reply after the
  // last user line.
  const lines: string[] = [SYSTEM_PROMPT, "", "---", "TRANSCRIPT SO FAR:"];
  for (const m of transcript) {
    lines.push(`[${m.role.toUpperCase()}] ${m.text}`);
  }
  lines.push("", "---", "Reply with the next JSON object only (single line, no fences).");
  return lines.join("\n");
}
