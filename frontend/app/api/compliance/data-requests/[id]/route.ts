import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORY_TEMPLATES, CATEGORY_ORDER } from "@/app/compliance/deletion-requests/deletion-requests-data";

type Disposition = "delete" | "keep" | "export-only";

/**
 * Execute the approved deletion: for every category set to "delete", purge the
 * patient's rows (soft-delete where the table supports it, hard-delete the
 * audit/consent/message tables, anonymize the shared users row). Returns the
 * human-readable labels of what was deleted vs retained for the summary.
 */
async function executePurge(
  patientId: string,
  decisions: Record<string, Disposition>,
): Promise<{ deleted: string[]; retained: string[] }> {
  const deleted: string[] = [];
  const retained: string[] = [];
  for (const key of CATEGORY_ORDER) {
    const t = CATEGORY_TEMPLATES[key];
    const dispo = decisions[key] ?? t.defaultDisposition;
    if (dispo !== "delete") {
      retained.push(`${t.label} (${t.reason})`);
      continue;
    }
    switch (key) {
      case "personal_info":
        await prisma.$executeRaw`
          UPDATE users SET "firstName"='Deleted', "lastName"='Patient', phone=NULL,
            "dateOfBirth"=NULL, gender=NULL, "profilePhotoUrl"=NULL, "updatedAt"=NOW()
          WHERE id=${patientId}::uuid`;
        break;
      case "recent_records":
        await prisma.$executeRaw`UPDATE medical_records SET "deletedAt"=NOW() WHERE "patientId"=${patientId}::uuid AND "deletedAt" IS NULL AND "createdAt" >= NOW() - INTERVAL '7 years'`;
        await prisma.$executeRaw`UPDATE prescriptions SET "deletedAt"=NOW() WHERE "patientId"=${patientId}::uuid AND "deletedAt" IS NULL AND "createdAt" >= NOW() - INTERVAL '7 years'`;
        await prisma.$executeRaw`UPDATE patient_documents SET "deletedAt"=NOW() WHERE "patientId"=${patientId}::uuid AND "deletedAt" IS NULL AND "uploadedAt" >= NOW() - INTERVAL '7 years'`;
        break;
      case "old_records":
        await prisma.$executeRaw`UPDATE medical_records SET "deletedAt"=NOW() WHERE "patientId"=${patientId}::uuid AND "deletedAt" IS NULL AND "createdAt" < NOW() - INTERVAL '7 years'`;
        await prisma.$executeRaw`UPDATE prescriptions SET "deletedAt"=NOW() WHERE "patientId"=${patientId}::uuid AND "deletedAt" IS NULL AND "createdAt" < NOW() - INTERVAL '7 years'`;
        await prisma.$executeRaw`UPDATE patient_documents SET "deletedAt"=NOW() WHERE "patientId"=${patientId}::uuid AND "deletedAt" IS NULL AND "uploadedAt" < NOW() - INTERVAL '7 years'`;
        break;
      case "audit_logs":
        await prisma.$executeRaw`DELETE FROM record_access_log WHERE "actorId"=${patientId}::uuid`;
        break;
      case "consent_records":
        await prisma.$executeRaw`DELETE FROM consent_requests WHERE "patientId"=${patientId}::uuid`;
        break;
      case "messages":
        await prisma.$executeRaw`DELETE FROM messages WHERE "patientId"=${patientId}::uuid`;
        break;
    }
    deleted.push(t.label);
  }
  return { deleted, retained };
}

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECISION_STATUSES = new Set(["approved_partial", "approved_full", "rejected", "in_progress", "blocked"]);

interface Row {
  id: string;
  type: string;
  status: string;
  channel: string;
  legalHold: boolean;
  legalHoldReason: string | null;
  decisionNote: string | null;
  decidedByName: string | null;
  decidedAt: Date | null;
  requestedAt: Date;
  firstName: string;
  lastName: string;
  email: string;
  patientCreatedAt: Date;
  patientId: string;
}

function shape(r: Row) {
  return {
    id: r.id,
    patientName: `${r.firstName} ${r.lastName}`.trim(),
    patientMrn: `CG-${r.patientCreatedAt.getUTCFullYear()}-${r.patientId.slice(0, 4).toUpperCase()}`,
    patientEmail: r.email,
    type: r.type,
    status: r.status,
    channel: r.channel,
    legalHold: r.legalHold,
    legalHoldReason: r.legalHoldReason,
    decisionNote: r.decisionNote,
    decidedBy: r.decidedByName,
    requestedAt: r.requestedAt.toISOString(),
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
  };
}

async function load(id: string, org: string): Promise<Row | null> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT d.id, d.type, d.status, d.channel, d."legalHold", d."legalHoldReason",
           d."decisionNote", d."decidedByName", d."decidedAt", d."requestedAt",
           u."firstName", u."lastName", u.email,
           u."createdAt" AS "patientCreatedAt", u.id::text AS "patientId"
    FROM data_requests d
    JOIN users u ON u.id = d."patientId"
    WHERE d.id = ${id}::uuid AND d."organizationId" = ${org}::uuid
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function guard(id: string) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) } as const;
  if (claims.role !== "Compliance Manager")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Compliance only." }, { status: 403 }) } as const;
  if (!isDbUid(claims.uid) || !UUID_RE.test(id))
    return { error: NextResponse.json({ ok: false, error: "Not found" }, { status: 404 }) } as const;
  // claims.org is the slug — resolve the real org UUID from the user row.
  const me = await prisma.$queryRaw<{ organizationId: string | null }[]>`
    SELECT "organizationId" FROM users WHERE id = ${claims.uid}::uuid LIMIT 1
  `;
  const orgId = me[0]?.organizationId;
  if (!orgId) return { error: NextResponse.json({ ok: false, error: "Not found" }, { status: 404 }) } as const;
  return { claims, orgId } as const;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await guard(id);
  if ("error" in g) return g.error;
  const row = await load(id, g.orgId);
  if (!row) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, request: shape(row) });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await guard(id);
  if ("error" in g) return g.error;

  let body: { status?: string; note?: string; decisions?: Record<string, Disposition> };
  try { body = (await req.json()) as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 }); }

  const status = DECISION_STATUSES.has(body.status ?? "") ? body.status! : null;
  if (!status) return NextResponse.json({ ok: false, error: "Invalid status." }, { status: 400 });
  const note = (body.note ?? "").trim();
  const decided = ["approved_partial", "approved_full", "rejected"].includes(status);
  if (decided && !note)
    return NextResponse.json({ ok: false, error: "A justification note is required for a decision." }, { status: 400 });

  const existing = await load(id, g.orgId);
  if (!existing) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (existing.legalHold)
    return NextResponse.json({ ok: false, error: "Blocked by legal hold." }, { status: 409 });

  // Execute the purge for approved DELETION requests, then fold the system
  // summary into the stored note so the patient sees what was deleted/retained.
  let finalNote = note || null;
  if (existing.type === "deletion" && (status === "approved_partial" || status === "approved_full")) {
    const { deleted, retained } = await executePurge(existing.patientId, body.decisions ?? {});
    const parts: string[] = [];
    if (deleted.length) parts.push(`Deleted: ${deleted.join("; ")}.`);
    if (retained.length) parts.push(`Retained: ${retained.join("; ")}.`);
    finalNote = [note, parts.join(" ")].filter(Boolean).join("\n\n");
  }

  await prisma.$executeRaw`
    UPDATE data_requests
    SET status = ${status},
        "decisionNote" = ${finalNote},
        "decidedByName" = ${decided ? g.claims.name : null},
        "decidedById" = ${decided ? g.claims.uid : null}::uuid,
        "decidedAt" = ${decided ? new Date() : null},
        "updatedAt" = NOW()
    WHERE id = ${id}::uuid
  `;
  const row = await load(id, g.orgId);
  return NextResponse.json({ ok: true, request: row ? shape(row) : null });
}
