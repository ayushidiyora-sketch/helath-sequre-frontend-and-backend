import { NextResponse } from "next/server";
import { createHash } from "crypto";
import bcrypt from "bcrypt";
import {
  PENDING_COOKIE,
  OTP_TTL_SECONDS,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  roleHome,
  signPending,
  signSession,
} from "@/lib/auth";
import { DEMO_PASSWORD, type LoginScope } from "@/lib/demo-users";
import { issueSession } from "@/lib/session-store";
import { recordChallengeIssued } from "@/lib/mfa-challenge-store";
import { mailerConfigured, otpEmail, sendMail } from "@/lib/mail";
import { checkPassword } from "@/lib/password-store";
import { lookupUserByEmail } from "@/lib/user-lookup";
import { prisma } from "@/lib/prisma";
import { UserStatus } from "@prisma/client";

export const runtime = "nodejs";

interface LoginBody {
  email?: string;
  password?: string;
  scope?: LoginScope;
  /** "Keep me signed in for 12 hours" — when true the session cookie persists
   *  across browser restarts; otherwise it's a session cookie cleared on close. */
  rememberMe?: boolean;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function devOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Demo email + password sign-in. On success it issues a short-lived
 * `hs_pending` cookie carrying the OTP hash + user id, and returns the dev
 * OTP so the MFA challenge page can show it inline (no SMTP/SMS in dev).
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const { email, password, scope } = body;
  const remember = body.rememberMe === true;
  if (!email || !password || !scope) {
    return NextResponse.json(
      { ok: false, error: "Email, password, and scope are required." },
      { status: 400 },
    );
  }

  const user = await lookupUserByEmail(email);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Email or password is incorrect." },
      { status: 401 },
    );
  }

  // Trim stray whitespace — temp/onboarding passwords are commonly copy-pasted
  // from emails or terminals, which can prepend a tab/space and break the match.
  // Our passwords never contain leading/trailing whitespace, so this is safe.
  const pw = password.trim();

  // Two password-check paths:
  //  - DB users (source: "database") have a real bcrypt hash → compare.
  //  - Demo users fall back to the in-memory password override + DEMO_PASSWORD seed.
  let passwordOk: boolean;
  if (user.source === "database" && user.passwordHash) {
    passwordOk = await bcrypt.compare(pw, user.passwordHash);
  } else {
    const override = checkPassword(user.uid, pw);
    passwordOk = override === undefined ? pw === DEMO_PASSWORD : override;
  }
  if (!passwordOk) {
    return NextResponse.json(
      { ok: false, error: "Email or password is incorrect." },
      { status: 401 },
    );
  }
  if (user.scope !== scope) {
    return NextResponse.json(
      { ok: false, error: "This account can't sign in from this portal." },
      { status: 403 },
    );
  }

  // Fast-path: DB users with mfaRequired=false (typically patients) skip OTP
  // and get a session cookie immediately.
  if (user.source === "database" && !user.mfaRequired) {
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
    // Stamp last login + clear lockout counters.
    await prisma.user
      .update({
        where: { id: user.uid },
        data: {
          lastLoginAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
          ...(user.status === "invited" ? { status: UserStatus.active } : {}),
        },
      })
      .catch((err: unknown) => {
        console.error("[auth/login] could not stamp lastLogin:", err);
      });
    const res = NextResponse.json({
      ok: true,
      email: user.email,
      redirect: roleHome(user.role),
      skipMfa: true,
    });
    res.cookies.set(SESSION_COOKIE, session, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      // "Keep me signed in" → persistent cookie (12h); otherwise a session
      // cookie cleared when the browser closes (JWT still expires in 12h).
      ...(remember ? { maxAge: SESSION_MAX_AGE } : {}),
    });
    return res;
  }

  // If the DB user has finished TOTP enrollment, prefer authenticator-app
  // codes over emailed OTPs. The pending cookie carries `mode: "totp"` so
  // /verify-otp knows to check against `users.mfaSecret` instead of a
  // server-generated hash.
  let totpMode = false;
  if (user.source === "database") {
    const dbInfo = await prisma.user.findUnique({
      where: { id: user.uid },
      select: { mfaSecret: true, mfaEnrolledAt: true },
    });
    if (dbInfo?.mfaSecret && dbInfo.mfaEnrolledAt) totpMode = true;
  }

  if (totpMode) {
    const pending = await signPending({
      uid: user.uid,
      otpHash: "",
      attempts: 0,
      mode: "totp",
      remember,
    });
    const res = NextResponse.json({
      ok: true,
      email: user.email,
      mode: "totp",
    });
    res.cookies.set(PENDING_COOKIE, pending, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: OTP_TTL_SECONDS,
    });
    return res;
  }

  const otp = devOtp();
  const otpHash = sha256(otp);
  const pending = await signPending({
    uid: user.uid,
    otpHash,
    attempts: 0,
    mode: "email",
    remember,
  });

  // Mirror the challenge into mfa_challenges for the compliance audit + Failed
  // MFA anomaly detector. Demo users (non-UUID uid) short-circuit inside the
  // helper, so this is a no-op for them.
  await recordChallengeIssued({
    uid: user.uid,
    otpHash,
    expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: req.headers.get("user-agent") || null,
  });

  let mailSent = false;
  if (mailerConfigured()) {
    const { subject, text, html } = otpEmail(otp);
    const result = await sendMail({ to: user.email, subject, text, html });
    mailSent = result.ok;
    if (result.ok) {
      console.log(`[auth/login] OTP sent via ${result.via} to ${user.email}`);
    } else {
      console.error(
        `[auth/login] mail send failed (last via ${result.via}): ${result.error}`,
      );
    }
  } else {
    console.warn("[auth/login] no mail transport configured — OTP returned in response as dev fallback");
  }

  // Always include the OTP in non-production responses so the MFA challenge
  // page can render the "Dev mode · your code is …" banner. This protects
  // demos against temp-mail / spam-filter / sandbox-block scenarios where the
  // upstream transport returns 200/202 but the recipient never sees the mail
  // (e.g. Resend sandbox forbids non-owner recipients with 403; SendGrid
  // accepts most addresses but downstream providers like 4nly.com silently
  // drop incoming mail). In production this branch is skipped so the OTP
  // only ever exists in the user's inbox.
  const includeDevOtp = !mailSent || process.env.NODE_ENV !== "production";
  const res = NextResponse.json({
    ok: true,
    email: user.email,
    mode: "email",
    ...(includeDevOtp ? { devOtp: otp } : {}),
  });
  res.cookies.set(PENDING_COOKIE, pending, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OTP_TTL_SECONDS,
  });
  return res;
}
