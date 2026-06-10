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
import { roleHome, isDbUid } from "@/lib/auth";
import { lookupUserByUid } from "@/lib/user-lookup";
import { prisma } from "@/lib/prisma";
import { orgHasActiveSubscription } from "@/lib/billing";
import { issueSession } from "@/lib/session-store";
import {
  recordChallengeAttempt,
  recordChallengeExhausted,
  recordChallengeUsed,
} from "@/lib/mfa-challenge-store";
import { UserStatus } from "@prisma/client";
import { verifyToken as verifyTotp } from "@/lib/mfa";

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

  // Validate the code differently depending on which OTP flavour was started
  // at login time: email = compare sha256(code) to the hash in the cookie;
  // totp = run the user's stored secret through the TOTP algorithm.
  let codeOk = false;
  if (pending.mode === "totp") {
    const dbUser = await prisma.user.findUnique({
      where: { id: pending.uid },
      select: { mfaSecret: true },
    });
    if (dbUser?.mfaSecret) {
      codeOk = verifyTotp({ token: code, secret: dbUser.mfaSecret });
    }
  } else {
    codeOk = sha256(code) === pending.otpHash;
  }

  if (!codeOk) {
    const attempts = pending.attempts + 1;
    if (attempts >= MAX_OTP_ATTEMPTS) {
      // Force the audit row to attemptsLeft=0 so the Failed MFA detector
      // picks this up even if a prior decrement was lost.
      await recordChallengeExhausted(pending.uid);
      return expiredResponse();
    }
    // Mirror the cookie-side decrement into the audit row.
    await recordChallengeAttempt(pending.uid);
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

  const user = await lookupUserByUid(pending.uid);
  if (!user) return expiredResponse();

  // First-sign-in promotion: a DB-backed user provisioned with status=invited
  // becomes "active" the moment they successfully complete the OTP step.
  // Also stamp lastLoginAt + clear any failure counters.
  if (user.source === "database") {
    await prisma.user
      .update({
        where: { id: user.uid },
        data: {
          ...(user.status === "invited" ? { status: UserStatus.active } : {}),
          lastLoginAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      })
      .catch((err: unknown) => {
        console.error("[verify-otp] could not update last-login / status:", err);
      });
  }

  // Stamp the audit row as used BEFORE issuing the session so a crash mid-
  // request can't leave the row looking like an unverified challenge.
  await recordChallengeUsed(user.uid);

  const { jwt: session } = await issueSession(
    {
      uid: user.uid,
      role: user.role,
      org: user.org,
      name: user.name,
      email: user.email,
    },
    { req },
  );
  // Patients get a one-time "want to set up an authenticator app?" prompt
  // after sign-in. Staff roles already have MFA mandated by /mfa-setup at
  // invite time, so they skip the prompt and land on their role home.
  const home = roleHome(user.role);
  let redirect =
    user.role === "Patient"
      ? `/mfa-prompt?next=${encodeURIComponent(home)}`
      : home;
  // A freshly-onboarded Org Admin with no active subscription is sent to Pricing
  // to pick a plan (soft redirect — the dashboard isn't hard-gated).
  if (user.role === "Org Admin" && user.source === "database" && isDbUid(user.uid)) {
    try {
      const rows = await prisma.$queryRaw<{ organizationId: string | null }[]>`
        SELECT "organizationId" FROM users WHERE id = ${user.uid}::uuid LIMIT 1
      `;
      const orgId = rows[0]?.organizationId;
      if (orgId && !(await orgHasActiveSubscription(orgId))) {
        redirect = "/pricing";
      }
    } catch (err) {
      console.error("[verify-otp] subscription check failed:", err);
    }
  }
  const res = NextResponse.json({ ok: true, redirect });
  res.cookies.delete(PENDING_COOKIE);
  res.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // "Keep me signed in" (carried from the password step) → persistent 12h
    // cookie; otherwise a session cookie cleared when the browser closes.
    ...(pending.remember ? { maxAge: SESSION_MAX_AGE } : {}),
  });
  return res;
}
