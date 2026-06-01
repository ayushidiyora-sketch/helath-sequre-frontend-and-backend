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

  // Two password-check paths:
  //  - DB users (source: "database") have a real bcrypt hash → compare.
  //  - Demo users fall back to the in-memory password override + DEMO_PASSWORD seed.
  let passwordOk: boolean;
  if (user.source === "database" && user.passwordHash) {
    passwordOk = await bcrypt.compare(password, user.passwordHash);
  } else {
    const override = checkPassword(user.uid, password);
    passwordOk = override === undefined ? password === DEMO_PASSWORD : override;
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
    const session = await signSession({
      uid: user.uid,
      sid: `s_${user.uid}_${Date.now().toString(36)}`,
      role: user.role,
      org: user.org,
      name: user.name,
      email: user.email,
    });
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
      maxAge: SESSION_MAX_AGE,
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
  const pending = await signPending({
    uid: user.uid,
    otpHash: sha256(otp),
    attempts: 0,
    mode: "email",
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
