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
    const dir = memoryDir(username.toLowerCase());
    const personaFile = path.join(dir, "persona.md");
    if (fs.existsSync(personaFile)) {
      const m = fs.readFileSync(personaFile, "utf8").match(/\*\*Agent name:\*\*\s*(.+)/);
      if (m) return m[1].trim();
    }
    if (fs.existsSync(dir)) {
      const hit = fs.readdirSync(dir).find((f) => /^user_agent_name_.+\.md$/.test(f));
      if (hit) {
        const slug = hit.replace(/^user_agent_name_/, "").replace(/\.md$/, "");
        if (slug) return slug.charAt(0).toUpperCase() + slug.slice(1);
      }
    }
    return null;
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
