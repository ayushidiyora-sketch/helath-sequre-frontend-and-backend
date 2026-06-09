import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Per-user "require a one-time code at sign-in" toggle (a GitHub-style switch
 * exposed on every role's profile/settings page).
 *
 * It drives `users.mfaRequired`, the same flag the login route reads: when ON,
 * sign-in challenges with an OTP (authenticator-app code if TOTP is enrolled,
 * otherwise an emailed code); when OFF, a DB user signs in straight to a
 * session with no second factor. See app/api/auth/login/route.ts.
 *
 * Demo (non-UUID) sessions can't persist — they always get an OTP — so GET
 * reports `demo: true` and the UI renders the switch read-only.
 */
export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  if (!isDbUid(claims.uid)) {
    return NextResponse.json({ ok: true, otpRequired: true, totpEnrolled: false, demo: true });
  }

  const user = await prisma.user.findUnique({
    where: { id: claims.uid },
    select: { mfaRequired: true, mfaSecret: true, mfaEnrolledAt: true },
  });
  if (!user) return NextResponse.json({ ok: false, error: "Account not found." }, { status: 404 });

  return NextResponse.json({
    ok: true,
    otpRequired: user.mfaRequired,
    totpEnrolled: !!user.mfaSecret && !!user.mfaEnrolledAt,
    demo: false,
  });
}

interface PutBody {
  otpRequired?: boolean;
}

export async function PUT(req: Request) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  if (!isDbUid(claims.uid)) {
    return NextResponse.json(
      { ok: false, error: "Demo account — sign in with a real account to change this." },
      { status: 400 },
    );
  }

  let body: PutBody;
  try { body = (await req.json()) as PutBody; }
  catch { return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 }); }

  if (typeof body.otpRequired !== "boolean")
    return NextResponse.json({ ok: false, error: "otpRequired (boolean) is required." }, { status: 400 });

  const user = await prisma.user.update({
    where: { id: claims.uid },
    data: { mfaRequired: body.otpRequired, updatedAt: new Date() },
    select: { mfaRequired: true, mfaSecret: true, mfaEnrolledAt: true },
  });

  return NextResponse.json({
    ok: true,
    otpRequired: user.mfaRequired,
    totpEnrolled: !!user.mfaSecret && !!user.mfaEnrolledAt,
    demo: false,
  });
}
