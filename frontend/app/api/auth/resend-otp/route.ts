import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "crypto";
import {
  OTP_TTL_SECONDS,
  PENDING_COOKIE,
  signPending,
  verifyPending,
} from "@/lib/auth";

export const runtime = "nodejs";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function devOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Issue a fresh OTP for the in-progress sign-in. Resets the attempt counter
 * and the 10-minute clock by re-signing the `hs_pending` cookie with a new
 * hash. Returns the dev OTP so the client can display it inline.
 */
export async function POST(): Promise<NextResponse> {
  const jar = await cookies();
  const pending = await verifyPending(jar.get(PENDING_COOKIE)?.value);
  if (!pending) {
    const res = NextResponse.json(
      { ok: false, expired: true, error: "Your session expired. Please sign in again." },
      { status: 401 },
    );
    res.cookies.delete(PENDING_COOKIE);
    return res;
  }

  const otp = devOtp();
  const updated = await signPending({
    uid: pending.uid,
    otpHash: sha256(otp),
    attempts: 0,
  });

  const res = NextResponse.json({ ok: true, devOtp: otp });
  res.cookies.set(PENDING_COOKIE, updated, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OTP_TTL_SECONDS,
  });
  return res;
}
