import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { memoryDir } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(req: NextRequest) {
  const session = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const user = findById(session.userId);
  if (!user || user.status !== "active") return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body?.agentName || "").trim().slice(0, 30);
  if (!name || !/^[A-Za-z][A-Za-z0-9 _-]{0,29}$/.test(name)) {
    return NextResponse.json({ ok: false, error: "Invalid agent name (must start with a letter, ≤30 chars)." }, { status: 400 });
  }

  const file = path.join(memoryDir(user.username.toLowerCase()), "persona.md");
  if (!fs.existsSync(file)) {
    return NextResponse.json({ ok: false, error: "Persona not found. Complete onboarding first." }, { status: 400 });
  }
  let text = fs.readFileSync(file, "utf-8");
  if (/\*\*Agent name:\*\*\s*(.+)/.test(text)) {
    text = text.replace(/\*\*Agent name:\*\*\s*.+/, `**Agent name:** ${name}`);
  } else {
    text = `**Agent name:** ${name}\n\n${text}`;
  }
  // Also update the `name:` frontmatter field if present.
  text = text.replace(/^name:\s*.+$/m, `name: ${name}`);
  fs.writeFileSync(file, text, "utf-8");
  return NextResponse.json({ ok: true, agentName: name });
}
