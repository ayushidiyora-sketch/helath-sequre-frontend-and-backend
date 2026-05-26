import { NextResponse } from "next/server";
import { PENDING_COOKIE, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(PENDING_COOKIE);
  return res;
}
