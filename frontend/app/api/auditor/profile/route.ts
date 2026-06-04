import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Profile + security feed for the Auditor Settings page. Auditor-only.
 * Returns the user's name / org / scope (the tenant slug they audit) plus
 * MFA enrollment state. Demo (non-UUID) sessions get a slim payload so the
 * page still renders without crashing.
 */
export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims)
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Auditor")
    return NextResponse.json({ ok: false, error: "Forbidden — Auditor only." }, { status: 403 });

  // Demo session fallback — surface what we know from the JWT.
  if (!isDbUid(claims.uid)) {
    return NextResponse.json({
      ok: true,
      profile: {
        name: claims.name,
        email: claims.email,
        organization: "Independent Regulator",
        scope: claims.org ?? "—",
        accountCreated: null,
        accountExpiresLabel: "Open-ended",
        mfaEnrolled: false,
        mfaRequired: true,
        sessionTimeoutMinutes: 15,
        sessionIpAllowlist: null,
      },
    });
  }

  // Real DB user — pull name + org + MFA enrollment + tenant slug.
  const rows = await prisma.$queryRaw<{
    firstName: string;
    lastName: string;
    email: string;
    organizationName: string | null;
    organizationSlug: string | null;
    mfaEnrolledAt: Date | null;
    mfaRequired: boolean;
    createdAt: Date;
  }[]>`
    SELECT u."firstName", u."lastName", u.email,
           o.name AS "organizationName",
           o.slug AS "organizationSlug",
           u."mfaEnrolledAt", u."mfaRequired", u."createdAt"
    FROM users u
    LEFT JOIN organizations o ON o.id = u."organizationId"
    WHERE u.id = ${claims.uid}::uuid
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return NextResponse.json({ ok: false, error: "Auditor not found." }, { status: 404 });

  // Session lifetime for this auditor — pick the most recent un-revoked row.
  const sessions = await prisma.$queryRaw<{ expiresAt: Date; ipAddress: string | null }[]>`
    SELECT "expiresAt", "ipAddress"
    FROM sessions
    WHERE "userId" = ${claims.uid}::uuid
      AND "revokedAt" IS NULL
    ORDER BY "issuedAt" DESC
    LIMIT 1
  `;
  const currentSession = sessions[0] ?? null;

  // Auditor "account expires" — derived as createdAt + 90 days. The DB has
  // no explicit user.expiresAt column; for the demo this gives the page a
  // real moving date instead of a hardcoded "Jun 1, 2026".
  const accountExpires = new Date(r.createdAt.getTime() + 90 * 24 * 60 * 60 * 1000);

  return NextResponse.json({
    ok: true,
    profile: {
      name: [r.firstName, r.lastName].filter(Boolean).join(" ").trim() || r.email,
      email: r.email,
      organization: r.organizationName ?? "Independent Regulator",
      scope: r.organizationSlug ?? "—",
      accountCreated: r.createdAt.toISOString(),
      accountExpiresLabel: accountExpires.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      mfaEnrolled: !!r.mfaEnrolledAt,
      mfaRequired: r.mfaRequired,
      sessionTimeoutMinutes: 15,
      sessionIpAllowlist: currentSession?.ipAddress ?? null,
      sessionExpiresAt: currentSession?.expiresAt.toISOString() ?? null,
    },
  });
}
