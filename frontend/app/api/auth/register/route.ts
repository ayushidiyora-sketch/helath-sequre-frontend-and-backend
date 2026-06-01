import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { Prisma, RoleKind, UserStatus } from "@prisma/client";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  roleHome,
  signSession,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mailerConfigured, otpEmail, sendMail } from "@/lib/mail";
import { lookupUserByEmail } from "@/lib/user-lookup";

export const runtime = "nodejs";

interface RegisterBody {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dob?: string;
  password?: string;
  privacyConsent?: boolean;
  termsAccepted?: boolean;
}

function isStrongPassword(p: string): boolean {
  if (typeof p !== "string" || p.length < 12) return false;
  if (!/[A-Z]/.test(p)) return false;
  if (!/\d/.test(p)) return false;
  if (!/[^A-Za-z0-9]/.test(p)) return false;
  return true;
}

function isEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/**
 * Patient self-registration. Creates a `users` row with `roleKind=patient`
 * and `organizationId=null` (the patient picks/consents to a clinic later),
 * sets a session cookie, and returns the redirect path. No OTP step — for
 * the demo we trust the email at sign-up and let the patient land straight
 * on the portal.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const firstName = body.firstName?.trim() ?? "";
  const lastName = body.lastName?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const phone = body.phone?.trim() ?? "";
  const dob = body.dob?.trim() ?? "";
  const password = body.password ?? "";

  if (!firstName || !lastName) {
    return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
  }
  if (!email || !isEmail(email)) {
    return NextResponse.json({ ok: false, error: "A valid email is required." }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ ok: false, error: "Phone number is required." }, { status: 400 });
  }
  if (!isStrongPassword(password)) {
    return NextResponse.json(
      { ok: false, error: "Password must be 12+ characters with a capital letter, number, and symbol." },
      { status: 400 },
    );
  }
  if (!body.privacyConsent || !body.termsAccepted) {
    return NextResponse.json(
      { ok: false, error: "You must accept the privacy notice and terms." },
      { status: 400 },
    );
  }

  // Duplicate-email guard — checks seeded users + DB.
  const existing = await lookupUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      {
        ok: false,
        error: "An account with this email already exists. Try signing in instead.",
      },
      { status: 409 },
    );
  }

  let dateOfBirth: Date | null = null;
  if (dob) {
    const d = new Date(dob);
    if (!Number.isNaN(d.getTime())) dateOfBirth = d;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  let created;
  try {
    created = await prisma.user.create({
      data: {
        organizationId: null,
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        dateOfBirth: dateOfBirth ?? undefined,
        roleKind: RoleKind.patient,
        status: UserStatus.active,
        // Self-registered patients are walked through TOTP enrollment right
        // after sign-up — see /mfa-setup. Once they confirm the 6-digit code,
        // future sign-ins will require it.
        mfaRequired: true,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "An account with this email already exists." },
        { status: 409 },
      );
    }
    throw err;
  }

  // Issue the session immediately — no OTP step for self-registration.
  const session = await signSession({
    uid: created.id,
    sid: `s_${created.id}_${Date.now().toString(36)}`,
    role: "Patient",
    org: null,
    name: `${firstName} ${lastName}`,
    email: created.email,
  });
  // Brand-new patient → 2FA enrollment. mfa-setup will sign them through
  // to /patient/dashboard after they confirm a TOTP code.
  const dashboard = roleHome("Patient");
  const redirect = `/mfa-setup?required=true&next=${encodeURIComponent(dashboard)}`;

  // Fire-and-forget welcome email; not critical for the response.
  if (mailerConfigured()) {
    const { subject, text, html } = otpEmail("000000"); // reuse template; subject ignored
    sendMail({
      to: email,
      subject: `Welcome to HealthSecure, ${firstName}`,
      text: text.replace("verification code is: 000000", `account is ready. Sign in any time at /login`),
      html: html.replace("000000", "Welcome!"),
    }).catch((e) => console.error("[register] welcome mail failed:", e));
  }

  const res = NextResponse.json({ ok: true, redirect });
  res.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
