import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const DATA_DIR = path.resolve(process.cwd(), "../data");
const LEGACY_PATH = path.join(DATA_DIR, "bento-modules.json");

type Priority = "none" | "green" | "amber" | "red";

interface Task {
  id: string;
  text: string;
  priority: Priority;
  done: boolean;
}

interface ProjectModule {
  id: string;
  title: string;
  accent: string;
  tasks: Task[];
}

function userPath(userId: string): string {
  return path.join(DATA_DIR, "users", userId, "bento-modules.json");
}

function resolvePath(req: NextRequest): string | null {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verify(cookie);
  if (!session) return null;
  const user = findById(session.userId);
  if (!user || user.status !== "active") return null;

  const perUser = userPath(user.id);
  // Migration: seed admin's per-user file from the legacy global file once.
  if (user.isAdmin && !fs.existsSync(perUser) && fs.existsSync(LEGACY_PATH)) {
    try {
      fs.mkdirSync(path.dirname(perUser), { recursive: true });
      fs.copyFileSync(LEGACY_PATH, perUser);
    } catch {}
  }
  return perUser;
}

function readModules(filePath: string): ProjectModule[] {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeModule);
  } catch {
    return [];
  }
}

function writeModules(filePath: string, data: ProjectModule[]) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  try {
    if (fs.existsSync(filePath)) {
      const existingText = fs.readFileSync(filePath, "utf-8");
      const existing = JSON.parse(existingText);
      if (Array.isArray(existing) && existing.length > 0) {
        const backupDir = path.join(dir, "bento-module-backups");
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        fs.writeFileSync(path.join(backupDir, `bento-modules-${stamp}.json`), existingText.endsWith("\n") ? existingText : existingText + "\n");
      }
    }
  } catch {}

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

function normalizeModule(m: Record<string, unknown>): ProjectModule {
  const tasks = Array.isArray(m.tasks) ? (m.tasks as Record<string, unknown>[]) : [];
  return {
    id: String(m.id ?? ""),
    title: String(m.title ?? ""),
    accent: String(m.accent ?? ""),
    tasks: tasks.map((t) => ({
      id: String(t.id ?? ""),
      text: String(t.text ?? ""),
      priority: (["none", "green", "amber", "red"].includes(String(t.priority))
        ? (t.priority as Priority)
        : "none"),
      done: Boolean(t.done),
    })),
  };
}

export async function GET(req: NextRequest) {
  const filePath = resolvePath(req);
  if (!filePath) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json(readModules(filePath));
}

export async function PUT(req: NextRequest) {
  const filePath = resolvePath(req);
  if (!filePath) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json();
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Expected array of modules" }, { status: 400 });
  }
  const normalized = body.map(normalizeModule);
  writeModules(filePath, normalized);
  return NextResponse.json({ ok: true, count: normalized.length });
}
