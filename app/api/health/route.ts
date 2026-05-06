import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

let cachedBuildId: string | null = null;

function readBuildId(): string {
  if (cachedBuildId) return cachedBuildId;
  try {
    cachedBuildId = readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf-8").trim();
  } catch {
    cachedBuildId = "unknown";
  }
  return cachedBuildId;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    buildId: readBuildId(),
    ts: new Date().toISOString(),
  });
}
