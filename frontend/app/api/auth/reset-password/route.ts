import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { UserStatus } from "@prisma/client";
import { verifyResetToken } from "@/lib/auth";
import { consumeJti, setPassword, validatePassword } from "@/lib/password-store";
import { prisma } from "@/lib/prisma";
import { lookupUserByUid } from "@/lib/user-lookup";

export const runtime = "nodejs";

interface ResetBody {
  token?: string;
  password?: string;
  confirmPassword?: string;
}

/**
 * Validate a reset-token without consuming it. The /reset-password page
 * calls this to decide whether to show the form or an "expired link"
 * message. Does NOT mark the token as used.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const token = new URL(req.url).searchParams.get("token") ?? undefined;
  const claims = await verifyResetToken(token);
  if (!claims) {
    return NextResponse.json(
      { ok: false, error: "This reset link is invalid or has expired." },
      { status: 400 },
    );
  }
  const user = await lookupUserByUid(claims.uid);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Account not found." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, email: user.email, name: user.name });
}

/**
 * Consume the reset token and set a new password. The token is single-use
 * (jti added to the used-set on success) and must match policy.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: ResetBody;
  try {
    body = (await req.json()) as ResetBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const token = body.token?.trim();
  const password = body.password ?? "";
  const confirm = body.confirmPassword ?? "";

  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing reset token." }, { status: 400 });
  }
  if (password !== confirm) {
    return NextResponse.json({ ok: false, error: "Passwords do not match." }, { status: 400 });
  }
  const policyError = validatePassword(password);
  if (policyError) {
    return NextResponse.json({ ok: false, error: policyError }, { status: 400 });
  }

  const claims = await verifyResetToken(token);
  if (!claims) {
    return NextResponse.json(
      { ok: false, error: "This reset link is invalid or has expired." },
      { status: 400 },
    );
  }

  const user = await lookupUserByUid(claims.uid);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Account not found." }, { status: 400 });
  }

  if (!consumeJti(claims.jti)) {
    return NextResponse.json(
      { ok: false, error: "This reset link has already been used. Request a new one." },
      { status: 400 },
    );
  }

  if (user.source === "database") {
    // Real user — write a bcrypt hash and clear the "invited" status so they
    // count as a fully active account from this point.
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.uid },
      data: {
        passwordHash,
        ...(user.status === "invited" ? { status: UserStatus.active } : {}),
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
  } else {
    // Demo seeded / in-memory user — store the override in the password-store.
    setPassword(claims.uid, password);
  }
  return NextResponse.json({ ok: true, email: user.email });
}
