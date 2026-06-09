import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession, type SessionClaims } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ACTIONS = new Set(["record.view", "record.download", "record.share"]);

/**
 * Single medical-record detail for the patient, plus its real access trail.
 *
 * The detail page used to fetch the whole `/api/patient/records` list (which
 * omits the uploaded file) and rendered a hard-coded "Access history". This
 * endpoint returns ONE record with full content — including the uploaded file
 * (`fileUrl`) for clinician-shared documents so the page can preview/download
 * the original — and the genuine access log from `record_access_log` merged
 * with the record's own lifecycle events (created / finalized / uploaded).
 *
 * GET also records a `record.view` event (deduped to one per actor per minute
 * so a re-render / Strict-Mode double effect doesn't spam the ledger).
 */

interface AccessEvent {
  actor: string;
  action: string;
  ip: string | null;
  at: string; // ISO
}

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? null;
}

async function logAccess(
  claims: SessionClaims,
  recordId: string,
  recordKind: string,
  action: string,
  ip: string | null,
  dedupeMinutes = 0,
): Promise<void> {
  try {
    if (dedupeMinutes > 0) {
      const recent = await prisma.$queryRaw<{ n: number }[]>`
        SELECT COUNT(*)::int AS n FROM record_access_log
        WHERE "recordId" = ${recordId}
          AND "actorId" = ${claims.uid}::uuid
          AND action = ${action}
          AND "createdAt" > NOW() - (${dedupeMinutes} * INTERVAL '1 minute')
      `;
      if ((recent[0]?.n ?? 0) > 0) return;
    }
    await prisma.$executeRaw`
      INSERT INTO record_access_log
        (id, "recordId", "recordKind", "actorId", "actorName", "actorRole", action, ip, "createdAt")
      VALUES
        (gen_random_uuid(), ${recordId}, ${recordKind}, ${claims.uid}::uuid,
         ${claims.name}, ${claims.role}, ${action}, ${ip}, NOW())
    `;
  } catch (err) {
    // Access logging is best-effort — never block the read on a ledger hiccup.
    console.warn("[record-access-log] insert failed:", err instanceof Error ? err.message : err);
  }
}

interface RxRow {
  id: string; drugName: string; strength: string | null; route: string | null;
  frequency: string | null; duration: string | null; refills: number;
  patientInstructions: string | null; finalizedAt: Date | null; createdAt: Date;
  clinicianFirstName: string; clinicianLastName: string; tenantName: string | null;
}
interface NoteRow {
  id: string; template: string; subjective: string | null; objective: string | null;
  assessment: string | null; plan: string | null; body: string | null;
  finalizedAt: Date | null; createdAt: Date;
  clinicianFirstName: string; clinicianLastName: string; tenantName: string | null;
}
interface DocRow {
  id: string; name: string; category: string; mimeType: string | null; sizeBytes: number;
  dataUrl: string | null; uploadedAt: Date;
  uploaderFirst: string | null; uploaderLast: string | null; tenantName: string | null;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Patient")
    return NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 });
  // Demo (non-UUID) ids are served by the static viewer on the client.
  if (!isDbUid(claims.uid) || !UUID_RE.test(id))
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const [rxs, notes, docs] = await Promise.all([
    prisma.$queryRaw<RxRow[]>`
      SELECT p.id, p."drugName", p.strength, p.route, p.frequency, p.duration,
             p.refills, p."patientInstructions", p."finalizedAt", p."createdAt",
             u."firstName" AS "clinicianFirstName", u."lastName" AS "clinicianLastName",
             o.name AS "tenantName"
      FROM prescriptions p
      JOIN users u ON u.id = p."clinicianId"
      LEFT JOIN organizations o ON o.id = p."organizationId"
      WHERE p.id = ${id}::uuid AND p."patientId" = ${claims.uid}::uuid AND p."deletedAt" IS NULL
      LIMIT 1
    `,
    prisma.$queryRaw<NoteRow[]>`
      SELECT m.id, m.template, m.subjective, m.objective, m.assessment, m.plan,
             m.body, m."finalizedAt", m."createdAt",
             u."firstName" AS "clinicianFirstName", u."lastName" AS "clinicianLastName",
             o.name AS "tenantName"
      FROM medical_records m
      JOIN users u ON u.id = m."clinicianId"
      LEFT JOIN organizations o ON o.id = m."organizationId"
      WHERE m.id = ${id}::uuid AND m."patientId" = ${claims.uid}::uuid AND m."deletedAt" IS NULL
      LIMIT 1
    `,
    prisma.$queryRaw<DocRow[]>`
      SELECT d.id, d.name, d.category, d."mimeType", d."sizeBytes", d."dataUrl", d."uploadedAt",
             u."firstName" AS "uploaderFirst", u."lastName" AS "uploaderLast",
             o.name AS "tenantName"
      FROM patient_documents d
      LEFT JOIN users u ON u.id = d."uploadedById"
      LEFT JOIN organizations o ON o.id = d."organizationId"
      WHERE d.id = ${id}::uuid AND d."patientId" = ${claims.uid}::uuid AND d."deletedAt" IS NULL
      LIMIT 1
    `,
  ]);

  let record: Record<string, unknown> | null = null;
  let kind = "";
  const lifecycle: AccessEvent[] = [];

  if (rxs[0]) {
    const r = rxs[0];
    kind = "prescription";
    const clinician = `Dr. ${r.clinicianFirstName} ${r.clinicianLastName}`.trim();
    const ts = (r.finalizedAt ?? r.createdAt).toISOString();
    record = {
      id: r.id, kind, title: `${r.drugName}${r.strength ? ` · ${r.strength}` : ""}`,
      subtitle: [r.route, r.frequency, r.duration].filter(Boolean).join(" · ") || "Prescription",
      category: "Prescription", clinician, facility: r.tenantName ?? "",
      date: ts.slice(0, 10), collectionDate: ts.slice(0, 10), status: "Active",
      prescription: {
        drug: r.drugName, strength: r.strength ?? "", form: r.route ?? "Oral",
        frequency: r.frequency ?? "", duration: r.duration ?? "",
        refills: String(r.refills ?? 0), instructions: r.patientInstructions ?? "",
      },
    };
    lifecycle.push({ actor: clinician, action: "record.create", ip: null, at: r.createdAt.toISOString() });
    if (r.finalizedAt) lifecycle.push({ actor: clinician, action: "record.finalize", ip: null, at: r.finalizedAt.toISOString() });
  } else if (notes[0]) {
    const n = notes[0];
    kind = "note";
    const clinician = `Dr. ${n.clinicianFirstName} ${n.clinicianLastName}`.trim();
    const ts = (n.finalizedAt ?? n.createdAt).toISOString();
    const isDischarge = n.template === "Discharge";
    const noteBody = n.body ?? [
      n.subjective ? `Subjective: ${n.subjective}` : "",
      n.objective ? `Objective: ${n.objective}` : "",
      n.assessment ? `Assessment: ${n.assessment}` : "",
      n.plan ? `Plan: ${n.plan}` : "",
    ].filter(Boolean).join("\n\n");
    record = {
      id: n.id, kind, title: isDischarge ? "Discharge summary" : `${n.template} note`,
      subtitle: `${n.template} · finalized`, category: isDischarge ? "Discharge" : "Clinical Note",
      clinician, facility: n.tenantName ?? "", date: ts.slice(0, 10), collectionDate: ts.slice(0, 10),
      status: "Finalized", noteBody,
    };
    lifecycle.push({ actor: clinician, action: "record.create", ip: null, at: n.createdAt.toISOString() });
    if (n.finalizedAt) lifecycle.push({ actor: clinician, action: "record.finalize", ip: null, at: n.finalizedAt.toISOString() });
  } else if (docs[0]) {
    const d = docs[0];
    kind = "document";
    const uploader = `${d.uploaderFirst ?? ""} ${d.uploaderLast ?? ""}`.trim();
    const uploadedBy = uploader ? `Dr. ${uploader}` : "Care team";
    const ts = d.uploadedAt.toISOString();
    record = {
      id: d.id, kind, title: d.name, subtitle: `${d.category} · uploaded by your care team`,
      category: d.category, clinician: uploadedBy, facility: d.tenantName ?? "",
      date: ts.slice(0, 10), collectionDate: ts.slice(0, 10), status: "Finalized",
      fileUrl: d.dataUrl, mimeType: d.mimeType, sizeBytes: d.sizeBytes,
    };
    lifecycle.push({ actor: uploadedBy, action: "record.upload", ip: null, at: ts });
  }

  if (!record) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  // Record this view (deduped to 1/min) before reading the trail back so it shows.
  await logAccess(claims, id, kind, "record.view", clientIp(req), 1);

  const logged = await prisma.$queryRaw<{ actorName: string; action: string; ip: string | null; createdAt: Date }[]>`
    SELECT "actorName", action, ip, "createdAt"
    FROM record_access_log
    WHERE "recordId" = ${id}
    ORDER BY "createdAt" DESC
    LIMIT 50
  `;
  const loggedEvents: AccessEvent[] = logged.map((e) => ({
    actor: e.actorName, action: e.action, ip: e.ip, at: e.createdAt.toISOString(),
  }));

  // Merge lifecycle (created/finalized/uploaded) + logged access events, newest first.
  const accessLog = [...loggedEvents, ...lifecycle].sort((a, b) => b.at.localeCompare(a.at));

  return NextResponse.json({ ok: true, record: { ...record, accessLog } });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Patient")
    return NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 });
  if (!isDbUid(claims.uid) || !UUID_RE.test(id))
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  let body: { action?: string; kind?: string };
  try { body = (await req.json()) as { action?: string; kind?: string }; }
  catch { return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 }); }

  const action = ALLOWED_ACTIONS.has(body.action ?? "") ? body.action! : null;
  if (!action) return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });

  await logAccess(claims, id, body.kind || "record", action, clientIp(req), 0);
  return NextResponse.json({ ok: true });
}
