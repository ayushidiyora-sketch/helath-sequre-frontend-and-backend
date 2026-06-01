import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/mfa";

export const runtime = "nodejs";

interface Body {
  code?: string;
}

/**
 * Confirm a TOTP enrollment: take the 6-digit code from the user's
 * authenticator app, compare it to the secret stashed during setup,
 * and stamp `mfaEnrolledAt` on success.
 */
export async function POST(req: Request) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const code = body.code?.trim() ?? "";
  if (!/^\d{6}$/.test(code.replace(/\s+/g, ""))) {
    return NextResponse.json({ ok: false, error: "Enter the 6-digit code." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: claims.uid },
    select: { id: true, mfaSecret: true },
  });
  if (!user || !user.mfaSecret) {
    return NextResponse.json(
      { ok: false, error: "No setup in progress. Start enrollment again." },
      { status: 400 },
    );
  }
  if (!verifyToken({ token: code, secret: user.mfaSecret })) {
    // 400 (not 401): user IS signed in; the request body is just wrong.
    // 401 would (rightly) make the browser think the session expired and
    // bounce the user back to /login mid-enrollment.
    return NextResponse.json(
      { ok: false, error: "Code didn't match. Check the time on your phone and try again." },
      { status: 400 },
    );
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnrolledAt: new Date(), mfaRequired: true },
  });
  return NextResponse.json({ ok: true });
}
