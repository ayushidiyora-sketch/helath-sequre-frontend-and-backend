import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** Reports the signed-in user's current 2FA state, used by settings pages. */
export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: claims.uid },
    select: { mfaSecret: true, mfaEnrolledAt: true, mfaRequired: true },
  });
  // Demo seeded users don't live in the DB; treat them as never-enrolled.
  if (!user) {
    return NextResponse.json({
      ok: true,
      enrolled: false,
      mfaRequired: false,
      enrolledAt: null,
    });
  }
  return NextResponse.json({
    ok: true,
    enrolled: !!user.mfaSecret && !!user.mfaEnrolledAt,
    mfaRequired: user.mfaRequired,
    enrolledAt: user.mfaEnrolledAt ? user.mfaEnrolledAt.toISOString() : null,
  });
}
