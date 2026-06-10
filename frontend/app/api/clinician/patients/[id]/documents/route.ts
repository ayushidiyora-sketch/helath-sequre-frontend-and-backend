import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appBaseUrl, sendActionEmail, sendActionSms } from "@/lib/notify";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_CATEGORIES = new Set(["Insurance", "ID Proof", "Lab Report", "Imaging", "Prescription", "Other"]);
const ALLOWED_SCAN = new Set(["pending_scan", "clean", "infected"]);
const MAX_DOC_BYTES = 25 * 1024 * 1024;

interface Row {
  id: string;
  name: string;
  category: string;
  mimeType: string | null;
  sizeBytes: number;
  scanStatus: string;
  dataUrl: string | null;
  uploadedAt: Date;
  uploaderFirst: string | null;
  uploaderLast: string | null;
}

function shape(r: Row) {
  const uploader = `${r.uploaderFirst ?? ""} ${r.uploaderLast ?? ""}`.trim();
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    scanStatus: r.scanStatus,
    dataUrl: r.dataUrl,
    uploadedAt: r.uploadedAt.toISOString(),
    uploaderName: uploader || "Clinic",
  };
}

/**
 * Resolve the signed-in clinician and authorize access to the target patient.
 * Authorization passes when the clinician is on the patient's care team (an
 * active `patient_assignment`) OR the patient is in the clinician's tenant.
 * Self-registered patients have `organizationId = null`, so the assignment is
 * the path that matters there. Returns the clinician's org id (used to stamp
 * uploads) + uid.
 */
async function guard(patientId: string) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) } as const;
  if (claims.role !== "Clinician")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Clinician only." }, { status: 403 }) } as const;
  if (!isDbUid(claims.uid) || !UUID_RE.test(patientId))
    return { error: NextResponse.json({ ok: true, documents: [] }) } as const;

  const rows = await prisma.$queryRaw<{ organizationId: string | null }[]>`
    SELECT "organizationId" FROM users
    WHERE id = ${claims.uid}::uuid AND "roleKind" = 'clinician' AND "deletedAt" IS NULL
    LIMIT 1
  `;
  const orgId = rows[0]?.organizationId ?? null;
  if (!orgId) return { error: NextResponse.json({ ok: false, error: "Clinician has no tenant." }, { status: 400 }) } as const;

  const auth = await prisma.$queryRaw<{ ok: number }[]>`
    SELECT 1 AS ok
    FROM users u
    WHERE u.id = ${patientId}::uuid AND u."roleKind" = 'patient' AND u."deletedAt" IS NULL
      AND (
        u."organizationId" = ${orgId}::uuid
        OR EXISTS (
          SELECT 1 FROM patient_assignments pa
          WHERE pa."patientId" = u.id AND pa."clinicianId" = ${claims.uid}::uuid AND pa."endedAt" IS NULL
        )
      )
    LIMIT 1
  `;
  if (!auth[0])
    return { error: NextResponse.json({ ok: false, error: "Patient is not on your panel." }, { status: 404 }) } as const;

  return { uid: claims.uid, orgId } as const;
}

/** GET — documents THIS clinician uploaded for the patient (own uploads only).
 *  Patient self-uploads and other clinicians' uploads are excluded here. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await guard(id);
  if ("error" in g) return g.error;

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT d.id, d.name, d.category, d."mimeType", d."sizeBytes", d."scanStatus",
           d."dataUrl", d."uploadedAt",
           u."firstName" AS "uploaderFirst", u."lastName" AS "uploaderLast"
    FROM patient_documents d
    LEFT JOIN users u ON u.id = d."uploadedById"
    WHERE d."patientId" = ${id}::uuid
      AND d."uploadedById" = ${g.uid}::uuid
      AND d."deletedAt" IS NULL
    ORDER BY d."uploadedAt" DESC
    LIMIT 200
  `;
  return NextResponse.json({ ok: true, documents: rows.map(shape) });
}

interface PostBody {
  name?: string;
  category?: string;
  mimeType?: string | null;
  sizeBytes?: number;
  dataUrl?: string | null;
  scanStatus?: string;
}

/** POST — clinician uploads a document for this patient (shared with patient). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await guard(id);
  if ("error" in g) return g.error;
  if (!UUID_RE.test(id))
    return NextResponse.json({ ok: false, error: "Invalid patient id." }, { status: 400 });

  let body: PostBody;
  try { body = (await req.json()) as PostBody; } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const name = body.name?.trim() ?? "";
  if (!name) return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
  if (name.length > 240) return NextResponse.json({ ok: false, error: "Name too long." }, { status: 400 });

  const category = ALLOWED_CATEGORIES.has(body.category ?? "") ? body.category! : "Other";
  const sizeBytes = Number.isFinite(body.sizeBytes) ? Math.max(0, Math.floor(Number(body.sizeBytes))) : 0;
  if (sizeBytes > MAX_DOC_BYTES)
    return NextResponse.json({ ok: false, error: "File too large (max 25 MB)." }, { status: 400 });
  const scanStatus = ALLOWED_SCAN.has(body.scanStatus ?? "") ? body.scanStatus! : "clean";
  if (scanStatus === "infected")
    return NextResponse.json({ ok: false, error: "Infected files cannot be stored." }, { status: 400 });
  const mimeType = body.mimeType?.trim() || null;
  const dataUrl = body.dataUrl ?? null;
  if (dataUrl && dataUrl.length > MAX_DOC_BYTES * 1.4)
    return NextResponse.json({ ok: false, error: "Encoded data too large." }, { status: 413 });
  if (dataUrl && !dataUrl.startsWith("data:"))
    return NextResponse.json({ ok: false, error: "dataUrl must be a data: URL." }, { status: 400 });

  // Patient authorization (assignment or same-tenant) already verified in guard().
  const inserted = await prisma.$queryRaw<Row[]>`
    INSERT INTO patient_documents
      (id, "patientId", "uploadedById", "organizationId", name, category,
       "mimeType", "sizeBytes", "dataUrl", "scanStatus", "sharedWithPatient",
       "uploadedAt", "updatedAt")
    VALUES
      (gen_random_uuid(), ${id}::uuid, ${g.uid}::uuid, ${g.orgId}::uuid,
       ${name}, ${category}, ${mimeType}, ${sizeBytes}, ${dataUrl},
       ${scanStatus}, TRUE, NOW(), NOW())
    RETURNING id, name, category, "mimeType", "sizeBytes", "scanStatus", "dataUrl", "uploadedAt",
              NULL::text AS "uploaderFirst", NULL::text AS "uploaderLast"
  `;

  // Notify the patient that a new document is available (best-effort).
  const notifyCtx = await prisma.$queryRaw<{
    patientEmail: string | null;
    patientPhone: string | null;
    patientFirst: string | null;
    clinicianFirst: string | null;
    clinicianLast: string | null;
    orgName: string | null;
  }[]>`
    SELECT p.email AS "patientEmail", p.phone AS "patientPhone", p."firstName" AS "patientFirst",
           c."firstName" AS "clinicianFirst", c."lastName" AS "clinicianLast",
           o.name AS "orgName"
    FROM users p
    LEFT JOIN users c         ON c.id = ${g.uid}::uuid
    LEFT JOIN organizations o ON o.id = ${g.orgId}::uuid
    WHERE p.id = ${id}::uuid LIMIT 1
  `;
  const c = notifyCtx[0];
  if (c?.patientEmail) {
    const clinicianName =
      `Dr. ${[c.clinicianFirst, c.clinicianLast].filter(Boolean).join(" ")}`.trim();
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    await sendActionEmail({
      orgId: g.orgId,
      to: c.patientEmail,
      categoryKey: "records",
      slug: "new-record-available",
      vars: {
        "patient.first_name": c.patientFirst?.trim() || "there",
        "clinician.name": clinicianName,
        "record.category": category,
        "record.date": today,
        "organization.name": c.orgName ?? "HealthSecure",
        action_url: `${appBaseUrl()}/patient/documents`,
      },
      fallbackSubject: `A new ${category} document is available in your portal`,
      fallbackText:
        `Hi ${c.patientFirst?.trim() || "there"},\n\n` +
        `${clinicianName} added a new ${category} document ("${name}") to your records on ${today}.\n\n` +
        `Open your portal to view it: ${appBaseUrl()}/patient/documents\n\n— ${c.orgName ?? "HealthSecure"}`,
    });
    await sendActionSms({
      toPhone: c.patientPhone,
      recipientEmail: c.patientEmail,
      categoryKey: "records",
      text: `${c.orgName ?? "HealthSecure"}: a new ${category} document is available in your portal.`,
    });
  }

  return NextResponse.json({ ok: true, document: shape(inserted[0]) }, { status: 201 });
}
