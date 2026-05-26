import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "crypto";
import {
  MAX_OTP_ATTEMPTS,
  OTP_TTL_SECONDS,
  PENDING_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signPending,
  signSession,
  verifyPending,
} from "@/lib/auth";
import { claimsFor, findDemoUserByUid } from "@/lib/demo-users";
import { roleHome } from "@/lib/auth";

export const runtime = "nodejs";

interface VerifyBody {
  code?: string;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function expiredResponse(): NextResponse {
  const res = NextResponse.json(
    { ok: false, expired: true, error: "Your code has expired. Please sign in again." },
    { status: 401 },
  );
  res.cookies.delete(PENDING_COOKIE);
  return res;
}

/**
 * Validate the OTP from the MFA challenge screen against the hash stored in
 * the `hs_pending` cookie. On success: clear pending, issue `hs_session`,
 * and tell the client where to land based on the user's role.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: VerifyBody;
  try {
    body = (await req.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const code = body.code?.trim();
  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { ok: false, error: "Enter the 6-digit code." },
      { status: 400 },
    );
  }

  const jar = await cookies();
  const pending = await verifyPending(jar.get(PENDING_COOKIE)?.value);
  if (!pending) return expiredResponse();

  if (sha256(code) !== pending.otpHash) {
    const attempts = pending.attempts + 1;
    if (attempts >= MAX_OTP_ATTEMPTS) return expiredResponse();
    const updated = await signPending({ ...pending, attempts });
    const res = NextResponse.json(
      {
        ok: false,
        error: `Incorrect code. ${MAX_OTP_ATTEMPTS - attempts} attempt${
          MAX_OTP_ATTEMPTS - attempts === 1 ? "" : "s"
        } left.`,
      },
      { status: 401 },
    );
    res.cookies.set(PENDING_COOKIE, updated, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: OTP_TTL_SECONDS,
    });
    return res;
  }

  const user = findDemoUserByUid(pending.uid);
  if (!user) return expiredResponse();

  const session = await signSession(claimsFor(user));
  // Patients get a one-time "want to set up an authenticator app?" prompt
  // after sign-in. Staff roles already have MFA mandated by /mfa-setup at
  // invite time, so they skip the prompt and land on their role home.
  const home = roleHome(user.role);
  const redirect =
    user.role === "Patient"
      ? `/mfa-prompt?next=${encodeURIComponent(home)}`
      : home;
  const res = NextResponse.json({ ok: true, redirect });
  res.cookies.delete(PENDING_COOKIE);
  res.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
