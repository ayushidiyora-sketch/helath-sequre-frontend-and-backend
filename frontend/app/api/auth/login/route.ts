import { NextResponse } from "next/server";
import { createHash } from "crypto";
import {
  PENDING_COOKIE,
  OTP_TTL_SECONDS,
  signPending,
} from "@/lib/auth";
import {
  DEMO_PASSWORD,
  findDemoUser,
  type LoginScope,
} from "@/lib/demo-users";

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

  const user = findDemoUser(email);
  if (!user || password !== DEMO_PASSWORD) {
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

  const otp = devOtp();
  const pending = await signPending({
    uid: user.uid,
    otpHash: sha256(otp),
    attempts: 0,
  });

  const res = NextResponse.json({ ok: true, email: user.email, devOtp: otp });
  res.cookies.set(PENDING_COOKIE, pending, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OTP_TTL_SECONDS,
  });
  return res;
}
