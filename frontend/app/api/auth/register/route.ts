import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { findDemoUser } from "@/lib/demo-users";

export const runtime = "nodejs";

interface RegisterBody {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  privacyConsent?: boolean;
  termsAccepted?: boolean;
}

function isStrongPassword(p: string): boolean {
  // Match the client-side rules in registration-wizard.tsx: 12+ chars with
  // at least one capital, one digit, and one symbol.
  if (typeof p !== "string" || p.length < 12) return false;
  if (!/[A-Z]/.test(p)) return false;
  if (!/\d/.test(p)) return false;
  if (!/[^A-Za-z0-9]/.test(p)) return false;
  return true;
}

function isEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const link = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/verify-email?token=${token}`;
  console.info(`[mail] verification link for ${email}: ${link}`);
}

async function sendVerificationSms(phone: string, code: string): Promise<void> {
  console.info(`[sms] OTP for ${phone}: ${code}`);
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const { firstName, lastName, email, phone, password } = body;

  if (!firstName?.trim() || !lastName?.trim()) {
    return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
  }
  if (!email || !isEmail(email)) {
    return NextResponse.json({ ok: false, error: "A valid email is required" }, { status: 400 });
  }
  // Demo build: the seeded accounts in lib/demo-users.ts stand in for the
  // "users" table. If the registrant tries one of those addresses, treat it
  // as a duplicate.
  if (findDemoUser(email)) {
    return NextResponse.json(
      { ok: false, error: "An account with this email already exists. Try signing in instead." },
      { status: 409 },
    );
  }
  if (!phone?.trim()) {
    return NextResponse.json({ ok: false, error: "Phone number is required" }, { status: 400 });
  }
  if (!password || !isStrongPassword(password)) {
    return NextResponse.json(
      { ok: false, error: "Password must be 12+ characters with a capital letter, number, and symbol." },
      { status: 400 },
    );
  }

  const emailToken = randomBytes(24).toString("hex");
  const phoneOtp = String(Math.floor(100000 + Math.random() * 900000));

  await Promise.all([
    sendVerificationEmail(email, emailToken),
    sendVerificationSms(phone, phoneOtp),
  ]);

  return NextResponse.json({ ok: true });
}
