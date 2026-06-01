import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/mfa";

export const runtime = "nodejs";

interface DisableBody {
  code?: string;
}

/**
 * Tear down TOTP (authenticator-app) enrollment for the signed-in user.
 *
 * Requires the current 6-digit code from the user's authenticator app so a
 * session-only attacker can't disable 2FA without also holding the device.
 * Clears `mfaSecret` + `mfaEnrolledAt` but KEEPS `mfaRequired = true` so
 * future sign-ins still get an OTP, just via email instead of the app.
 */
export async function POST(req: Request) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  let body: DisableBody;
  try {
    body = (await req.json()) as DisableBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const code = body.code?.replace(/\s+/g, "") ?? "";
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { ok: false, error: "Enter the 6-digit code from your authenticator app." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: claims.uid },
    select: { id: true, mfaSecret: true, mfaEnrolledAt: true },
  });
  if (!user) {
    return NextResponse.json({ ok: false, error: "Account not found." }, { status: 404 });
  }
  if (!user.mfaSecret || !user.mfaEnrolledAt) {
    // Already off — nothing to disable; treat as success so retries are safe.
    return NextResponse.json({ ok: true, wasEnrolled: false });
  }

  if (!verifyToken({ token: code, secret: user.mfaSecret })) {
    return NextResponse.json(
      { ok: false, error: "Code didn't match. Check the time on your phone and try again." },
      { status: 401 },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      mfaSecret: null,
      mfaEnrolledAt: null,
      // Leave mfaRequired as-is — sign-in falls back to email-OTP.
    },
  });
  return NextResponse.json({ ok: true, wasEnrolled: true });
}
