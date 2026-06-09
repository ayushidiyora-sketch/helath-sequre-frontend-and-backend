import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Billing pre-fill for the checkout page — name + email from the session, org
 * name resolved from the user's tenant. Returns blanks (not an error) for
 * signed-out / demo visitors so checkout still works for prospects.
 */
export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: true, fullName: "", email: "", orgName: "" });

  let orgName = "";
  if (isDbUid(claims.uid)) {
    try {
      const rows = await prisma.$queryRaw<{ name: string | null }[]>`
        SELECT o.name FROM users u
        LEFT JOIN organizations o ON o.id = u."organizationId"
        WHERE u.id = ${claims.uid}::uuid LIMIT 1
      `;
      orgName = rows[0]?.name ?? "";
    } catch {
      orgName = "";
    }
  }

  return NextResponse.json({
    ok: true,
    fullName: claims.name ?? "",
    email: claims.email ?? "",
    orgName,
  });
}
