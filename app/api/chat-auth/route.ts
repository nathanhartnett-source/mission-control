import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

export async function POST(req: NextRequest) {
  const { pin, person } = await req.json();
  const allowedPerson = ["nathan", "tessa", "karl", "tracy"].includes(person) ? person : null;
  if (!allowedPerson) return NextResponse.json({ ok: false }, { status: 400 });

  const pinEnvMap: Record<string, string | undefined> = {
    nathan: process.env.NATHAN_CHAT_PIN,
    tessa: process.env.TESSA_CHAT_PIN,
    karl: process.env.KARL_CHAT_PIN,
    tracy: process.env.TRACY_CHAT_PIN,
  };
  const envKey = pinEnvMap[person];
  const secret = process.env.CHAT_TOKEN_SECRET;
  if (!envKey || !secret) return NextResponse.json({ ok: false }, { status: 403 });
  if (pin !== envKey) return NextResponse.json({ ok: false }, { status: 401 });

  // Daily-rotating token: HMAC-SHA256 of "person:YYYY-MM-DD" using secret
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Brisbane" });
  const token = createHmac("sha256", secret).update(`${person}:${today}`).digest("hex");
  return NextResponse.json({ ok: true, token });
}
