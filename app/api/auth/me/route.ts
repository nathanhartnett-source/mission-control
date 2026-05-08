import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { memoryDir } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readAgentName(username: string): string | null {
  try {
    const file = path.join(memoryDir(username.toLowerCase()), "persona.md");
    if (!fs.existsSync(file)) return null;
    const body = fs.readFileSync(file, "utf8");
    const m = body.match(/\*\*Agent name:\*\*\s*(.+)/);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verify(cookie);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const user = findById(session.userId);
  if (!user || user.status !== "active") {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      personaCompleted: !!user.personaCompleted,
      agentName: readAgentName(user.username),
      avatarSeed: user.avatarSeed || `user:${user.username}`,
      agentAvatarSeeds: user.agentAvatarSeeds || {},
    },
  });
}
