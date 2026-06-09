import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { orgHasActiveSubscription } from "@/lib/billing";

export const runtime = "nodejs";

/**
 * Whether the signed-in user's tenant has an active subscription. Drives the
 * Org-Admin access gate (no subscription → forced to /pricing). Demo sessions
 * and users without a resolvable org are reported active so they aren't locked
 * out of the demo.
 */
export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  // Only Org Admins are gated; demo (non-UUID) sessions aren't.
  if (claims.role !== "Org Admin" || !isDbUid(claims.uid)) {
    return NextResponse.json({ ok: true, active: true, gated: false });
  }

  const rows = await prisma.$queryRaw<{ organizationId: string | null }[]>`
    SELECT "organizationId" FROM users WHERE id = ${claims.uid}::uuid LIMIT 1
  `;
  const orgId = rows[0]?.organizationId;
  if (!orgId) return NextResponse.json({ ok: true, active: true, gated: false });

  const active = await orgHasActiveSubscription(orgId);
  return NextResponse.json({ ok: true, active, gated: true });
}
