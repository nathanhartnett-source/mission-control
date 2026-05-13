// Onboarding save endpoint.
//
// Accepts the compiled plan from the interview, writes all the memory
// files via writeOnboardingMemories, seeds initial home bentos from the
// dashboard pillar, marks the user's persona complete.

import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById, markPersonaCompleted } from "@/lib/users";
import { writeOnboardingMemories, provisionWorkspace } from "@/lib/workspace";
import { audit } from "@/lib/auth-audit";
import { clientIp } from "@/lib/rate-limit";
import type { CompiledPlan } from "@/lib/onboarding-interview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TONES = ["concise", "warm", "dry-wit", "professional", "playful"] as const;
const FORMS = ["casual", "balanced", "formal"] as const;

function clampStr(v: unknown, max: number, fallback = ""): string {
  return typeof v === "string" ? v.slice(0, max) : fallback;
}
function clampArr(v: unknown, max: number, itemMax = 200): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.slice(0, itemMax) : ""))
    .filter((s) => s.trim().length > 0)
    .slice(0, max);
}

export async function POST(req: NextRequest) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const user = findById(session.userId);
  if (!user || user.status !== "active") {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const raw = (body?.plan || {}) as Partial<CompiledPlan>;

  const agentName = clampStr(raw.agentName, 30) || "Agent";
  if (!/^[A-Za-z][A-Za-z0-9 _-]{0,29}$/.test(agentName)) {
    return NextResponse.json({ ok: false, error: "Invalid agent name." }, { status: 400 });
  }

  const tone = (TONES as readonly string[]).includes(raw.comms?.tone || "") ? raw.comms!.tone : "warm";
  const formality = (FORMS as readonly string[]).includes(raw.comms?.formality || "") ? raw.comms!.formality : "balanced";

  const plan = {
    agentName,
    identity: {
      role: clampStr(raw.identity?.role, 300),
      context: clampStr(raw.identity?.context, 500),
      about: clampStr(raw.identity?.about, 2000),
    },
    friction: {
      painPoints: clampArr(raw.friction?.painPoints, 10),
      topConcern: clampStr(raw.friction?.topConcern, 400),
    },
    tools: {
      primary: clampArr(raw.tools?.primary, 12),
      notes: clampStr(raw.tools?.notes, 600),
    },
    dashboard: {
      wantsBentos: clampArr(raw.dashboard?.wantsBentos, 6, 500),
      pinnedApps: clampArr(raw.dashboard?.pinnedApps, 8, 64),
      notes: clampStr(raw.dashboard?.notes, 600),
    },
    comms: {
      tone: tone as typeof TONES[number],
      formality: formality as typeof FORMS[number],
      emoji: !!raw.comms?.emoji,
      notes: clampStr(raw.comms?.notes, 400),
    },
    focus: {
      initialGoals: clampArr(raw.focus?.initialGoals, 8),
      firstWeek: clampStr(raw.focus?.firstWeek, 800),
    },
    principles: {
      boundaries: clampArr(raw.principles?.boundaries, 8),
      careful: clampArr(raw.principles?.careful, 8),
      mustDo: clampArr(raw.principles?.mustDo, 8),
    },
    summary: clampStr(raw.summary, 2000),
    suggestedApps: Array.isArray(raw.suggestedApps)
      ? raw.suggestedApps.slice(0, 5).map((s) => ({
          name: clampStr((s as { name?: string }).name, 80),
          description: clampStr((s as { description?: string }).description, 1200),
          why: clampStr((s as { why?: string }).why, 240),
        })).filter((s) => s.name && s.description)
      : [],
  };

  try {
    provisionWorkspace(user.username);
    writeOnboardingMemories(user.username, plan);
    await seedHomeBentos(user.username, plan.dashboard.wantsBentos);
    await seedDemoAlertIfEmpty(user.username, plan);
    markPersonaCompleted(user.id);
    try { (await import("@/lib/achievements")).bump(user.username, "agent_trains"); } catch {}
    audit("onboarding_complete", {
      userId: user.id,
      username: user.username,
      ip: clientIp(req),
      ua: req.headers.get("user-agent") || "",
      agentName,
      tone,
      formality,
      pillars: ["identity", "friction", "tools", "dashboard", "comms", "focus", "principles"],
    });
    return NextResponse.json({ ok: true, suggestedApps: plan.suggestedApps });
  } catch (e) {
    console.error("[onboarding/save]", e);
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 });
  }
}

async function seedHomeBentos(username: string, wantsBentos: string[]): Promise<void> {
  try {
    const { createBento, listBentos } = await import("@/lib/home-bentos");
    if (listBentos(username).length > 0) return; // don't trample existing
    // Seed up to 4 from the interview output.
    for (const prompt of wantsBentos.slice(0, 4)) {
      const title = prompt.split(/[.,!?]/)[0].slice(0, 60).trim() || "Bento";
      createBento(username, prompt, 12, title);
    }
    // ALWAYS guarantee at least one demo bento exists so the home screen
    // demonstrates the system on first visit. Generic enough to be useful
    // to anyone; the user can edit, rename, or delete from the ⚙ menu.
    if (listBentos(username).length === 0) {
      createBento(
        username,
        "Give me a friendly 3-bullet briefing for today: one interesting thing in world news, one in tech, one quick wellbeing nudge. Keep it under 100 words total. This is a starter bento — edit the prompt or delete it once you have your own.",
        12,
        "Today's briefing",
      );
    }
  } catch (e) {
    console.warn("[onboarding/save] seed bentos skipped:", (e as Error).message);
  }
}

async function seedDemoAlertIfEmpty(
  username: string,
  plan: { focus: { initialGoals: string[]; firstWeek: string }; agentName: string },
): Promise<void> {
  try {
    const { listDataAlerts, createDataAlert } = await import("@/lib/data-alerts");
    if (listDataAlerts(username).length > 0) return;
    const goalsLine = plan.focus.initialGoals.slice(0, 3).join("; ") || "settling into the new dashboard";
    createDataAlert(username, {
      kind: "research",
      prompt: `Check in on the user. Their focus this period: ${goalsLine}. Write a friendly weekly nudge: one question that helps them reflect on progress, one small concrete suggestion, and an offer to dig deeper if useful. Under 120 words.`,
      frequencyHours: 168,
      summary: `Weekly check-in nudge — fires every Monday-ish. Edit or disable any time on the Alerts page.`,
      cooldownHours: 144,
      active: true,
    });
  } catch (e) {
    console.warn("[onboarding/save] seed alert skipped:", (e as Error).message);
  }
}
