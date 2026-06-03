import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "crypto";
import {
  OTP_TTL_SECONDS,
  PENDING_COOKIE,
  signPending,
  verifyPending,
} from "@/lib/auth";
import { lookupUserByUid } from "@/lib/user-lookup";
import { recordChallengeIssued } from "@/lib/mfa-challenge-store";
import { mailerConfigured, otpEmail, sendMail } from "@/lib/mail";

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
export async function POST(req: Request): Promise<NextResponse> {
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
  const otpHash = sha256(otp);
  const updated = await signPending({
    uid: pending.uid,
    otpHash,
    attempts: 0,
  });

  // Mirror the fresh challenge into mfa_challenges (revokes any prior unused
  // row inside the helper, then inserts the new one with attemptsLeft=5).
  await recordChallengeIssued({
    uid: pending.uid,
    otpHash,
    expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: req.headers.get("user-agent") || null,
  });

  let mailSent = false;
  // lookupUserByUid checks demo users AND the Postgres `users` table, so
  // DB-backed patients (self-registered via /register) get a real resend too.
  const user = await lookupUserByUid(pending.uid);
  if (mailerConfigured() && user) {
    const { subject, text, html } = otpEmail(otp);
    const result = await sendMail({ to: user.email, subject, text, html });
    mailSent = result.ok;
    if (result.ok) {
      console.log(`[auth/resend-otp] OTP resent via ${result.via} to ${user.email}`);
    } else {
      console.error(`[auth/resend-otp] mail send failed via ${result.via}: ${result.error}`);
    }
  }

  // Mirror the login route: in non-production always include the OTP so the
  // user can fall back to the on-screen banner when the email is silently
  // dropped by a temp-mail / spam filter, even if the transport said 200.
  const includeDevOtp = !mailSent || process.env.NODE_ENV !== "production";
  const res = NextResponse.json({
    ok: true,
    ...(includeDevOtp ? { devOtp: otp } : {}),
  });
  res.cookies.set(PENDING_COOKIE, updated, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OTP_TTL_SECONDS,
  });
  return res;
}
