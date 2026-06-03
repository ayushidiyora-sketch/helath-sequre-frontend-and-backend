import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface Row {
  id: string;
  name: string;
  category: string;
  mimeType: string | null;
  sizeBytes: number;
  scanStatus: string;
  dataUrl: string | null;
  uploadedAt: Date;
}

function shape(r: Row) {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    scanStatus: r.scanStatus,
    dataUrl: r.dataUrl,
    uploadedAt: r.uploadedAt.toISOString(),
  };
}

async function guard() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) } as const;
  if (claims.role !== "Patient")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 }) } as const;
  if (!isDbUid(claims.uid))
    return { error: NextResponse.json({ ok: true, documents: [] }) } as const;
  return { uid: claims.uid } as const;
}

const ALLOWED_CATEGORIES = new Set(["Insurance", "ID Proof", "Lab Report", "Imaging", "Prescription", "Other"]);
const ALLOWED_SCAN_STATUSES = new Set(["pending_scan", "clean", "infected"]);
const MAX_DOC_BYTES = 25 * 1024 * 1024; // 25 MB

export async function GET() {
  const g = await guard();
  if ("error" in g) return g.error;
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT id, name, category, "mimeType", "sizeBytes", "scanStatus", "dataUrl", "uploadedAt"
    FROM patient_documents
    WHERE "patientId" = ${g.uid}::uuid
      AND "deletedAt" IS NULL
    ORDER BY "uploadedAt" DESC
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

export async function POST(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;

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
  const scanStatus = ALLOWED_SCAN_STATUSES.has(body.scanStatus ?? "") ? body.scanStatus! : "pending_scan";
  if (scanStatus === "infected")
    return NextResponse.json({ ok: false, error: "Infected files cannot be stored." }, { status: 400 });
  const mimeType = body.mimeType?.trim() || null;
  const dataUrl = body.dataUrl ?? null;
  if (dataUrl && dataUrl.length > MAX_DOC_BYTES * 1.4)
    return NextResponse.json({ ok: false, error: "Encoded data too large." }, { status: 413 });
  if (dataUrl && !dataUrl.startsWith("data:"))
    return NextResponse.json({ ok: false, error: "dataUrl must be a data: URL." }, { status: 400 });

  // Resolve the patient's tenant (FK requirement on patient_documents).
  // Self-registered patients have no own organizationId — fall back to the
  // first active care-team clinician's tenant so an unassigned-self-signup
  // user can still upload after their first PatientAssignment lands.
  const userRows = await prisma.$queryRaw<{ organizationId: string | null }[]>`
    SELECT "organizationId" FROM users WHERE id = ${g.uid}::uuid LIMIT 1
  `;
  let orgId = userRows[0]?.organizationId ?? null;
  if (!orgId) {
    const fallback = await prisma.$queryRaw<{ organizationId: string | null }[]>`
      SELECT c."organizationId"
      FROM patient_assignments pa
      JOIN users c ON c.id = pa."clinicianId"
      WHERE pa."patientId" = ${g.uid}::uuid
        AND pa."endedAt" IS NULL
        AND c."organizationId" IS NOT NULL
      ORDER BY pa."startedAt" DESC
      LIMIT 1
    `;
    orgId = fallback[0]?.organizationId ?? null;
  }
  if (!orgId)
    return NextResponse.json({ ok: false, error: "No tenant on your account — ask your clinic to assign a clinician to you first." }, { status: 400 });

  const inserted = await prisma.$queryRaw<Row[]>`
    INSERT INTO patient_documents
      (id, "patientId", "uploadedById", "organizationId", name, category,
       "mimeType", "sizeBytes", "dataUrl", "scanStatus", "sharedWithPatient",
       "uploadedAt", "updatedAt")
    VALUES
      (gen_random_uuid(), ${g.uid}::uuid, ${g.uid}::uuid, ${orgId}::uuid,
       ${name}, ${category}, ${mimeType}, ${sizeBytes}, ${dataUrl},
       ${scanStatus}, TRUE, NOW(), NOW())
    RETURNING id, name, category, "mimeType", "sizeBytes", "scanStatus", "dataUrl", "uploadedAt"
  `;
  return NextResponse.json({ ok: true, document: shape(inserted[0]) }, { status: 201 });
}

export async function DELETE(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  if (!isDbUid(id))
    return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  await prisma.$executeRaw`
    UPDATE patient_documents SET "deletedAt" = NOW(), "updatedAt" = NOW()
    WHERE id = ${id}::uuid AND "patientId" = ${g.uid}::uuid
  `;
  return NextResponse.json({ ok: true });
}
