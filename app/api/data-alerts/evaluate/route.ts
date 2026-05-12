import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "child_process";
import { listAllDataAlerts, updateDataAlert } from "@/lib/data-alerts";
import { evaluateValue, evaluatePerBrand, readLatestPsiRows, compareValue } from "@/lib/alert-sources";
import { postMessage } from "@/lib/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/data-alerts/evaluate  — loopback-only.
// Cron hits this every N minutes; we walk every user's alerts, evaluate, and
// drop an inbox message if the rule is true AND we're outside cooldown.
function isLoopback(req: NextRequest): boolean {
  const h = req.headers;
  const fwd = (h.get("x-forwarded-for") || "").split(",")[0].trim();
  if (fwd && fwd !== "127.0.0.1" && fwd !== "::1") return false;
  const host = h.get("host") || "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
}

export async function POST(req: NextRequest) {
  if (!isLoopback(req)) return NextResponse.json({ error: "loopback only" }, { status: 403 });

  const alerts = listAllDataAlerts();
  const fired: { id: string; owner: string; value: number }[] = [];
  const errs: { id: string; reason: string }[] = [];

  for (const a of alerts) {
    if (!a.active) continue;
    try {
      const cooldownMs = (a.cooldownHours || 24) * 3600 * 1000;
      if (a.lastFiredAt && Date.now() - new Date(a.lastFiredAt).getTime() < cooldownMs) continue;

      // ─── Research alert ──────────────────────────────────────────────────
      if (a.kind === "research") {
        const freqMs = Math.max(1, a.frequencyHours || 24) * 3600 * 1000;
        if (a.lastEvaluatedAt && Date.now() - new Date(a.lastEvaluatedAt).getTime() < freqMs) continue;

        const sysPrompt = `You are a research alert worker. Your job: search the web for the topic the user has asked to be alerted about, and decide if there is anything NEW or NOTABLE worth pinging them about RIGHT NOW.

Context — previous finding summary (so you don't re-fire on the same thing):
${a.lastFindingSummary ? a.lastFindingSummary.slice(0, 800) : "(none — this is the first run)"}

USER'S WATCH BRIEF:
${a.prompt || ""}

INSTRUCTIONS:
- Use web search tools to look for current information matching the brief.
- Compare against the previous-finding summary above; do NOT fire on items already covered there.
- Only fire if you find something genuinely new and notable per the brief.
- Be conservative. False alerts are worse than misses.

Respond with ONLY a single JSON object (no prose, no markdown fences):
{
  "found": <true if something new+notable, else false>,
  "summary": "<if found: 2-4 sentence summary of what's new, with key facts. If not found: brief 1-sentence note of what you checked.>",
  "sources": ["<url>", "<url>"]
}`;

        const CLAUDE_BIN = process.env.CLAUDE_BIN || "/home/nathan/.npm-global/bin/claude";
        const r = spawnSync(CLAUDE_BIN, ["-p", "--model", "claude-sonnet-4-6"], {
          input: sysPrompt,
          encoding: "utf8",
          timeout: 180000,
          maxBuffer: 4 * 1024 * 1024,
        });
        const raw = (r.stdout || "").trim();
        updateDataAlert(a.owner, a.id, { lastEvaluatedAt: new Date().toISOString() });
        let parsed: { found?: boolean; summary?: string; sources?: string[] } | null = null;
        if (raw) {
          try { parsed = JSON.parse(raw); }
          catch {
            const m = raw.match(/\{[\s\S]*\}/);
            if (m) try { parsed = JSON.parse(m[0]); } catch {}
          }
        }
        if (!parsed) { errs.push({ id: a.id, reason: "research parse fail" }); continue; }
        if (!parsed.found) continue;

        const sourcesTxt = (parsed.sources || []).map((u) => `- ${u}`).join("\n");
        postMessage(a.owner, {
          from: "Alerts",
          subject: a.label || "Research alert",
          body: `${parsed.summary || "(no summary)"}${sourcesTxt ? "\n\nSources:\n" + sourcesTxt : ""}`,
          level: "info",
          href: "/alerts",
        });
        updateDataAlert(a.owner, a.id, {
          lastFiredAt: new Date().toISOString(),
          lastFindingSummary: parsed.summary || "",
        });
        fired.push({ id: a.id, owner: a.owner, value: 1 });
        continue;
      }

      // ─── Data alert (AI-judged when intent is present) ───────────────────
      if (!a.source) { errs.push({ id: a.id, reason: "no source" }); continue; }

      // AI-judged path: gather current values, hand to Sonnet with the user's
      // brief, let it decide whether to fire and craft the inbox body.
      if (a.intent && a.intent.trim()) {
        const isAll = (a.dims?.brand || "") === "all";
        const isPsi = a.source === "psi-mobile" || a.source === "psi-desktop";
        const strategy = a.source === "psi-desktop" ? "desktop" : "mobile";

        let samples: { label: string; value: number | null }[] = [];

        if (isPsi) {
          // Page-level granularity for PSI. Brand filter: map dim id to label.
          const brandMap: Record<string, string> = { "mro-au": "MRO AU", "mro-nz": "MRO NZ", "fob-au": "FOB AU", "fob-nz": "FOB NZ", "bmo": "BMO", "helix": "Helix", "mo": "MO" };
          const brandFilter = isAll ? null : (brandMap[a.dims?.brand || ""] || null);
          const rows = readLatestPsiRows(strategy, brandFilter);
          samples = rows.map((r) => ({ label: `${r.brand} · ${r.page} · ${r.url}`, value: r.score }));
        } else if (isAll) {
          samples = (await evaluatePerBrand(a.source, a.owner)).map((r) => ({ label: r.brandLabel, value: r.value }));
        } else {
          const v = await evaluateValue(a.source, a.dims || {}, a.owner);
          samples = [{ label: v.label, value: v.value }];
        }

        const valuesBlock = samples.map((s) => `  - ${s.label}: ${s.value == null ? "(no data)" : s.value}`).join("\n");
        const hint = (a.op != null && a.threshold != null) ? `\nThreshold hint provided by user: value ${a.op} ${a.threshold}` : "";
        const lastFired = a.lastFiredAt ? `\nLast fired: ${a.lastFiredAt} (cooldown ${a.cooldownHours}h).` : "\nHasn't fired yet.";
        const minSamples = Math.max(1, a.minConsecutiveSamples || 1);
        const streakNote = minSamples > 1 ? `\nThe user wants at least ${minSamples} consecutive checks meeting their criterion before firing. Current streak: ${a.consecutiveCount || 0}.` : "";

        const judgePrompt = `You are an alert judge. The user set up an alert with this brief:

USER BRIEF:
${a.intent}

CURRENT DATA (source: ${a.source}, fetched just now):
${valuesBlock || "  (no data available)"}
${hint}${streakNote}${lastFired}

DECIDE: based ONLY on the user's brief, should this alert fire RIGHT NOW? Be conservative — false alerts erode trust. If the situation is borderline or normal, do NOT fire.

If you decide to fire, craft a short inbox message body (markdown OK) that:
- Tells them WHAT triggered (specific values, brands, etc.)
- Tells them WHY it matters (per their brief)
- Includes any extra analysis/recommendations the user asked for in their brief

Respond with ONLY this JSON (no prose, no markdown fences):
{
  "shouldAlert": <true|false>,
  "subject": "<short alert subject if firing, else empty>",
  "body": "<inbox message body if firing, else empty>",
  "reason": "<one short sentence explaining your decision either way>"
}`;

        const CLAUDE_BIN = process.env.CLAUDE_BIN || "/home/nathan/.npm-global/bin/claude";
        const r = spawnSync(CLAUDE_BIN, ["-p", "--model", "claude-sonnet-4-6"], {
          input: judgePrompt,
          encoding: "utf8",
          timeout: 90000,
          maxBuffer: 2 * 1024 * 1024,
        });
        const raw = (r.stdout || "").trim();
        let verdict: { shouldAlert?: boolean; subject?: string; body?: string; reason?: string } | null = null;
        if (raw) {
          try { verdict = JSON.parse(raw); }
          catch {
            const m = raw.match(/\{[\s\S]*\}/);
            if (m) try { verdict = JSON.parse(m[0]); } catch {}
          }
        }
        if (!verdict) { errs.push({ id: a.id, reason: "judge parse fail" }); continue; }

        const triggered = !!verdict.shouldAlert;
        const nextCount = triggered ? (a.consecutiveCount || 0) + 1 : 0;
        const lastValueSummary = samples.map((s) => `${s.label}=${s.value ?? "—"}`).join(", ").slice(0, 200);
        updateDataAlert(a.owner, a.id, { consecutiveCount: nextCount, lastEvaluatedAt: new Date().toISOString(), lastFindingSummary: lastValueSummary });
        if (!triggered) continue;
        if (nextCount < minSamples) continue;

        postMessage(a.owner, {
          from: "Alerts",
          subject: verdict.subject?.slice(0, 200) || a.label || "Alert",
          body: verdict.body || verdict.reason || "Alert fired.",
          level: "warn",
          href: "/alerts",
        });
        updateDataAlert(a.owner, a.id, { lastFiredAt: new Date().toISOString(), consecutiveCount: 0 });
        fired.push({ id: a.id, owner: a.owner, value: nextCount });
        continue;
      }

      // Legacy threshold-only path (no AI judge — for older alerts)
      if (a.op == null || a.threshold == null) { errs.push({ id: a.id, reason: "missing op/threshold" }); continue; }

      // All-brands variant: evaluate each brand and fire one consolidated msg.
      if ((a.dims?.brand || "") === "all") {
        const results = await evaluatePerBrand(a.source, a.owner);
        const triggered = results.filter((r) => r.value != null && compareValue(r.value as number, a.op as string, a.threshold as number));
        const minSamples = Math.max(1, a.minConsecutiveSamples || 1);
        const nextCount = triggered.length > 0 ? (a.consecutiveCount || 0) + 1 : 0;
        updateDataAlert(a.owner, a.id, { lastValue: triggered.length, consecutiveCount: nextCount });
        if (triggered.length === 0) continue;
        if (nextCount < minSamples) continue;

        const lines = triggered.map((r) => `- ${r.brandLabel}: ${r.value}`).join("\n");
        postMessage(a.owner, {
          from: "Alerts",
          subject: `${a.label || a.source}: ${triggered.length} brand${triggered.length === 1 ? "" : "s"} ${a.op} ${a.threshold}`,
          body: `Your alert "${a.label || a.source}" triggered for the following brands:\n\n${lines}\n\nRule: ${a.op} ${a.threshold}\nCooldown: ${a.cooldownHours}h before this can fire again.`,
          level: "warn",
          href: "/alerts",
        });
        updateDataAlert(a.owner, a.id, { lastFiredAt: new Date().toISOString(), consecutiveCount: 0 });
        fired.push({ id: a.id, owner: a.owner, value: triggered.length });
        continue;
      }

      const { value, label } = await evaluateValue(a.source, a.dims || {}, a.owner);
      if (value == null) {
        updateDataAlert(a.owner, a.id, { lastValue: value });
        errs.push({ id: a.id, reason: "no value" }); continue;
      }

      if (a.op == null || a.threshold == null) { errs.push({ id: a.id, reason: "missing op/threshold" }); continue; }
      const triggered = compareValue(value, a.op, a.threshold);
      const minSamples = Math.max(1, a.minConsecutiveSamples || 1);
      const nextCount = triggered ? (a.consecutiveCount || 0) + 1 : 0;
      updateDataAlert(a.owner, a.id, { lastValue: value, consecutiveCount: nextCount });
      if (!triggered) continue;
      if (nextCount < minSamples) continue;

      postMessage(a.owner, {
        from: "Alerts",
        subject: `${a.label || label}: ${value} ${a.op} ${a.threshold}`,
        body: `Your alert "${a.label || label}" triggered.\n\nValue: ${value}\nRule: ${a.op} ${a.threshold}\n\nCooldown: ${a.cooldownHours}h before this can fire again.`,
        level: "warn",
        href: "/alerts",
      });
      updateDataAlert(a.owner, a.id, { lastFiredAt: new Date().toISOString(), consecutiveCount: 0 });
      fired.push({ id: a.id, owner: a.owner, value });
    } catch (e) {
      errs.push({ id: a.id, reason: (e as Error).message });
    }
  }

  return NextResponse.json({ ok: true, evaluated: alerts.length, fired, errs });
}
