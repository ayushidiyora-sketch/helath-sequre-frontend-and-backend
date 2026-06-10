import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentToken } from "@/lib/mfa";

export const runtime = "nodejs";

/**
 * DEV ONLY. Returns the TOTP code valid *right now* (at the server clock) for
 * the signed-in user's in-progress `mfaSecret`. The dev machine's clock can be
 * far from a real phone's, so a phone-generated code never matches during
 * enrollment / sign-in; this lets the UI offer a working code. Returns 404 in
 * production so it can never be used to bypass MFA there.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: claims.uid },
    select: { mfaSecret: true },
  });
  if (!user?.mfaSecret) {
    return NextResponse.json({ ok: false, error: "No setup in progress." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, devCode: currentToken(user.mfaSecret) });
}
