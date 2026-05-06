import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface CronSchedule {
  kind: "cron" | "every";
  expr?: string;
  everyMs?: number;
  anchorMs?: number;
  tz?: string;
}

interface JobState {
  nextRunAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: string;
  lastError?: string;
  consecutiveErrors?: number;
}

interface RawJob {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  agentId?: string | null;
  schedule: CronSchedule;
  state?: JobState;
}

interface CronJobResponse {
  id: string;
  name: string;
  agent: string;
  enabled: boolean;
  scheduleHuman: string;
  nextRunMs: number | null;
  lastRunMs: number | null;
  lastStatus: string | null;
  lastError: string | null;
  consecutiveErrors: number;
}

const AGENT_LABELS: Record<string, string> = {
  main: "Ash",
  mia: "Mia",
  cassie: "Cassie",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_RANGE_NAMES: Record<string, string> = {
  "1-5": "Weekdays",
  "0-6": "Daily",
  "1-7": "Daily",
};

function cronToHuman(expr: string, tz?: string): string {
  const tzLabel = tz === "Australia/Brisbane" ? "AEST" : tz || "AEST";
  const parts = expr.split(/\s+/);
  if (parts.length < 5) return expr;

  const [minute, hour, dayOfMonth, _month, dayOfWeek] = parts;
  const time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;

  if (dayOfMonth !== "*" && dayOfMonth !== "?") {
    const suffix =
      dayOfMonth === "1" ? "st" : dayOfMonth === "2" ? "nd" : dayOfMonth === "3" ? "rd" : "th";
    return `${dayOfMonth}${suffix} of month at ${time} ${tzLabel}`;
  }

  if (dayOfWeek === "*" || dayOfWeek === "?") {
    return `Daily at ${time} ${tzLabel}`;
  }

  if (DAY_RANGE_NAMES[dayOfWeek]) {
    return `${DAY_RANGE_NAMES[dayOfWeek]} at ${time} ${tzLabel}`;
  }

  // Single day number
  const dayNum = parseInt(dayOfWeek, 10);
  if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 7) {
    const name = DAY_NAMES[dayNum % 7];
    return `${name} at ${time} ${tzLabel}`;
  }

  // Comma-separated days
  if (/^[\d,]+$/.test(dayOfWeek)) {
    const names = dayOfWeek.split(",").map((d) => DAY_NAMES[parseInt(d, 10) % 7]);
    return `${names.join(", ")} at ${time} ${tzLabel}`;
  }

  return `${expr} ${tzLabel}`;
}

function everyToHuman(everyMs?: number): string {
  if (!everyMs) return "Unknown interval";
  const hours = Math.round(everyMs / 3600000);
  if (hours < 24) return `Every ${hours}h`;
  const days = Math.round(hours / 24);
  return `Every ${days}d`;
}

export async function GET() {
  try {
    const jobsPath = join(homedir(), ".openclaw", "cron", "jobs.json");
    const raw = readFileSync(jobsPath, "utf-8");
    const parsed = JSON.parse(raw) as { version: number; jobs: RawJob[] };

    const jobs: CronJobResponse[] = parsed.jobs.map((job) => {
      const agentLabel =
        job.agentId == null ? "Ash" : AGENT_LABELS[job.agentId] || job.agentId;

      const scheduleHuman =
        job.schedule.kind === "cron" && job.schedule.expr
          ? cronToHuman(job.schedule.expr, job.schedule.tz)
          : everyToHuman(job.schedule.everyMs);

      return {
        id: job.id,
        name: job.name,
        agent: agentLabel,
        enabled: job.enabled,
        scheduleHuman,
        nextRunMs: job.state?.nextRunAtMs ?? null,
        lastRunMs: job.state?.lastRunAtMs ?? null,
        lastStatus: job.state?.lastStatus ?? null,
        lastError: job.state?.lastError ?? null,
        consecutiveErrors: job.state?.consecutiveErrors ?? 0,
      };
    });

    return NextResponse.json(jobs);
  } catch (err) {
    console.error("Crons API error:", err);
    return NextResponse.json({ error: "Failed to read cron jobs" }, { status: 500 });
  }
}
