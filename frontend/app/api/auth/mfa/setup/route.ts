import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import QRCode from "qrcode";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildOtpAuthUri, newSecret } from "@/lib/mfa";

export const runtime = "nodejs";

/**
 * Start a TOTP enrollment. Generates a fresh secret, stashes it on the user
 * row (overwriting any prior, un-confirmed secret), and returns:
 *   - the otpauth:// URI (for apps that paste links)
 *   - a base64 PNG QR code (for apps that scan)
 *   - the raw base32 secret (for manual entry)
 *
 * The user is NOT considered enrolled until POST /mfa/verify succeeds — at
 * that point we stamp `mfaEnrolledAt`.
 */
export async function POST() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  // We only have DB-backed MFA for users in the `users` table. Demo seeded
  // users don't have an mfaSecret column path; reject so we don't pretend.
  const user = await prisma.user.findUnique({
    where: { id: claims.uid },
    select: { id: true, email: true, mfaEnrolledAt: true },
  });
  if (!user) {
    return NextResponse.json({ ok: false, error: "Account not eligible for TOTP setup." }, { status: 400 });
  }

  const secret = newSecret();
  const otpAuthUri = buildOtpAuthUri({ email: user.email, secret });
  const qrDataUrl = await QRCode.toDataURL(otpAuthUri, { margin: 1, width: 240 });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      mfaSecret: secret,
      // Clear any prior enrollment timestamp — they must re-verify.
      mfaEnrolledAt: null,
    },
  });

  return NextResponse.json({
    ok: true,
    secret,
    otpAuthUri,
    qrDataUrl,
    alreadyEnrolled: !!user.mfaEnrolledAt,
  });
}
