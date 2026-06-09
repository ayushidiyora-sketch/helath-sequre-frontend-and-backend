import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORY_TEMPLATES, CATEGORY_ORDER, type DataCategoryDecision } from "@/app/compliance/deletion-requests/deletion-requests-data";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Real, per-patient data categories for a deletion/export request — replaces
 * the hardcoded `STANDARD_CATEGORIES` in the decision matrix. Counts come from
 * the patient's actual rows; the retention copy + suggested disposition come
 * from CATEGORY_TEMPLATES. Export requests suggest export-only for every row.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Compliance Manager")
    return NextResponse.json({ ok: false, error: "Forbidden — Compliance only." }, { status: 403 });
  if (!isDbUid(claims.uid) || !UUID_RE.test(id))
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const me = await prisma.$queryRaw<{ organizationId: string | null }[]>`
    SELECT "organizationId" FROM users WHERE id = ${claims.uid}::uuid LIMIT 1
  `;
  const orgId = me[0]?.organizationId;
  if (!orgId) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const reqRows = await prisma.$queryRaw<{ patientId: string; type: string }[]>`
    SELECT "patientId"::text AS "patientId", type
    FROM data_requests
    WHERE id = ${id}::uuid AND "organizationId" = ${orgId}::uuid
    LIMIT 1
  `;
  if (!reqRows[0]) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  const pid = reqRows[0].patientId;
  const isExport = reqRows[0].type === "export";

  const n = (rows: { c: number }[]) => Number(rows[0]?.c ?? 0);
  const [
    notesRecent, rxRecent, docsRecent,
    notesOld, rxOld, docsOld,
    auditCount, consentCount, msgCount,
  ] = await Promise.all([
    prisma.$queryRaw<{ c: number }[]>`SELECT COUNT(*)::int AS c FROM medical_records WHERE "patientId"=${pid}::uuid AND "deletedAt" IS NULL AND "createdAt" >= NOW() - INTERVAL '7 years'`,
    prisma.$queryRaw<{ c: number }[]>`SELECT COUNT(*)::int AS c FROM prescriptions WHERE "patientId"=${pid}::uuid AND "deletedAt" IS NULL AND "createdAt" >= NOW() - INTERVAL '7 years'`,
    prisma.$queryRaw<{ c: number }[]>`SELECT COUNT(*)::int AS c FROM patient_documents WHERE "patientId"=${pid}::uuid AND "deletedAt" IS NULL AND "uploadedAt" >= NOW() - INTERVAL '7 years'`,
    prisma.$queryRaw<{ c: number }[]>`SELECT COUNT(*)::int AS c FROM medical_records WHERE "patientId"=${pid}::uuid AND "deletedAt" IS NULL AND "createdAt" < NOW() - INTERVAL '7 years'`,
    prisma.$queryRaw<{ c: number }[]>`SELECT COUNT(*)::int AS c FROM prescriptions WHERE "patientId"=${pid}::uuid AND "deletedAt" IS NULL AND "createdAt" < NOW() - INTERVAL '7 years'`,
    prisma.$queryRaw<{ c: number }[]>`SELECT COUNT(*)::int AS c FROM patient_documents WHERE "patientId"=${pid}::uuid AND "deletedAt" IS NULL AND "uploadedAt" < NOW() - INTERVAL '7 years'`,
    prisma.$queryRaw<{ c: number }[]>`SELECT COUNT(*)::int AS c FROM record_access_log WHERE "actorId"=${pid}::uuid`,
    prisma.$queryRaw<{ c: number }[]>`SELECT COUNT(*)::int AS c FROM consent_requests WHERE "patientId"=${pid}::uuid`,
    prisma.$queryRaw<{ c: number }[]>`SELECT COUNT(*)::int AS c FROM messages WHERE "patientId"=${pid}::uuid`,
  ]);

  const held: Record<string, string> = {
    personal_info: "Profile, contact details",
    recent_records: `${n(notesRecent)} clinical notes, ${n(rxRecent)} prescriptions, ${n(docsRecent)} documents`,
    old_records: `${n(notesOld)} clinical notes, ${n(rxOld)} prescriptions, ${n(docsOld)} documents`,
    audit_logs: `${n(auditCount)} access events`,
    consent_records: `${n(consentCount)} consent records`,
    messages: `${n(msgCount)} messages`,
  };

  const categories: DataCategoryDecision[] = CATEGORY_ORDER.map((key) => {
    const t = CATEGORY_TEMPLATES[key];
    return {
      ...t,
      held: held[key] ?? "—",
      defaultDisposition: isExport ? "export-only" : t.defaultDisposition,
    };
  });

  return NextResponse.json({ ok: true, categories, type: reqRows[0].type });
}
