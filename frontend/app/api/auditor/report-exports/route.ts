import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const VALID_KEYS = new Set(["compliance_summary", "access_report", "consent_compliance", "audit_summary"]);
const VALID_FORMATS = new Set(["pdf", "xlsx"]);

async function guard() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) } as const;
  // Org Admin also writes here from the /admin/reports page — every role that
  // can pull a report on a tenant should be allowed to log the download.
  if (
    claims.role !== "Auditor" &&
    claims.role !== "Compliance Manager" &&
    claims.role !== "Org Admin"
  )
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Auditor / Compliance / Org Admin only." }, { status: 403 }) } as const;
  if (!isDbUid(claims.uid))
    return { error: NextResponse.json({ ok: true, count: 0, recent: [] }) } as const;
  const rows = await prisma.$queryRaw<{ organizationId: string | null }[]>`
    SELECT "organizationId" FROM users WHERE id = ${claims.uid}::uuid LIMIT 1
  `;
  const orgId = rows[0]?.organizationId;
  if (!orgId) return { error: NextResponse.json({ ok: true, count: 0, recent: [] }) } as const;
  return { orgId, uid: claims.uid, email: claims.email ?? null } as const;
}

/** GET — return the tenant's total report-export count + most-recent 20 rows. */
export async function GET() {
  const g = await guard();
  if ("error" in g) return g.error;

  const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM report_exports WHERE "organizationId" = ${g.orgId}::uuid
  `;
  const recent = await prisma.$queryRaw<{
    id: string; reportKey: string; format: string; userEmail: string | null; createdAt: Date;
  }[]>`
    SELECT id, "reportKey", format, "userEmail", "createdAt"
    FROM report_exports
    WHERE "organizationId" = ${g.orgId}::uuid
    ORDER BY "createdAt" DESC
    LIMIT 20
  `;
  return NextResponse.json({
    ok: true,
    count: Number(n),
    recent: recent.map((r) => ({
      id: r.id,
      reportKey: r.reportKey,
      format: r.format,
      userEmail: r.userEmail,
      exportedAt: r.createdAt.toISOString(),
    })),
  });
}

/** POST — log one export. Called from the Reports page after a successful
 *  download so the dashboard's "Generated reports" tile reflects activity. */
export async function POST(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;

  let body: { reportKey?: string; format?: string };
  try { body = (await req.json()) as { reportKey?: string; format?: string }; }
  catch { return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 }); }

  const reportKey = (body.reportKey ?? "").trim();
  const format = (body.format ?? "").trim();
  if (!VALID_KEYS.has(reportKey))
    return NextResponse.json({ ok: false, error: "Unknown report key" }, { status: 400 });
  if (!VALID_FORMATS.has(format))
    return NextResponse.json({ ok: false, error: "Format must be pdf or xlsx" }, { status: 400 });

  await prisma.$executeRaw`
    INSERT INTO report_exports ("organizationId", "userId", "userEmail", "reportKey", format)
    VALUES (${g.orgId}::uuid, ${g.uid}::uuid, ${g.email}, ${reportKey}, ${format})
  `;
  return NextResponse.json({ ok: true });
}
