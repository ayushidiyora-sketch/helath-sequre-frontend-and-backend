import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Shared session + tenant guard for every Compliance/Auditor API route. Lives
 * outside `app/api/*` so it can be exported from a non-route module (Next.js
 * route.ts files may only export HTTP handlers — exporting helpers from them
 * trips the App Router type checker).
 *
 * Returns either an early NextResponse to send back (401/403/empty-payload
 * for demo users / missing tenant), or `{orgId, uid}` for the happy path.
 */
export async function guardCompliance(): Promise<
  | { error: NextResponse; orgId?: never; uid?: never }
  | { error?: never; orgId: string; uid: string }
> {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims)
    return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) };
  if (claims.role !== "Compliance Manager" && claims.role !== "Auditor")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Compliance / Auditor only." }, { status: 403 }) };
  if (!isDbUid(claims.uid))
    return { error: NextResponse.json({ ok: true, policies: [] }) };

  const rows = await prisma.$queryRaw<{ organizationId: string | null }[]>`
    SELECT "organizationId" FROM users WHERE id = ${claims.uid}::uuid LIMIT 1
  `;
  const orgId = rows[0]?.organizationId;
  if (!orgId) return { error: NextResponse.json({ ok: true, policies: [] }) };
  return { orgId, uid: claims.uid };
}
