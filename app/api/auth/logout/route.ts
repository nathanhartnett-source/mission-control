import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("mc_auth", "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
    secure: false,
  });
  return res;
}
