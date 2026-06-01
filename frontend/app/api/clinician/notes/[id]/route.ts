import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface NoteRow {
  id: string;
  patientId: string;
  clinicianId: string;
  template: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  body: string | null;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  finalizedAt: Date | null;
  deletedAt: Date | null;
  patientFirstName: string | null;
  patientLastName: string | null;
}

async function guardClinician() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) } as const;
  if (claims.role !== "Clinician")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Clinician only." }, { status: 403 }) } as const;
  return { claims } as const;
}

function shape(r: NoteRow) {
  return {
    id: r.id,
    patientId: r.patientId,
    clinicianId: r.clinicianId,
    template: r.template,
    subjective: r.subjective,
    objective: r.objective,
    assessment: r.assessment,
    plan: r.plan,
    body: r.body,
    status: r.status,
    version: Number(r.version),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    finalizedAt: r.finalizedAt ? r.finalizedAt.toISOString() : null,
    patientName:
      [r.patientFirstName, r.patientLastName].filter(Boolean).join(" ").trim() || null,
  };
}

async function findOne(id: string): Promise<NoteRow | null> {
  const rows = await prisma.$queryRaw<NoteRow[]>`
    SELECT m.id, m."patientId", m."clinicianId", m.template, m.subjective, m.objective,
           m.assessment, m.plan, m.body, m.status, m.version,
           m."createdAt", m."updatedAt", m."finalizedAt", m."deletedAt",
           u."firstName" AS "patientFirstName",
           u."lastName"  AS "patientLastName"
    FROM medical_records m
    LEFT JOIN users u ON u.id = m."patientId"
    WHERE m.id = ${id}::uuid
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await guardClinician();
  if ("error" in g) return g.error;
  if (!UUID_RE.test(id))
    return NextResponse.json({ ok: false, error: "Invalid note id." }, { status: 400 });
  const r = await findOne(id);
  if (!r || r.deletedAt || r.clinicianId !== g.claims.uid)
    return NextResponse.json({ ok: false, error: "Note not found." }, { status: 404 });
  return NextResponse.json({ ok: true, note: shape(r) });
}

interface PatchBody {
  template?: string;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  body?: string | null;
  status?: "draft" | "finalized";
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await guardClinician();
  if ("error" in g) return g.error;
  if (!UUID_RE.test(id))
    return NextResponse.json({ ok: false, error: "Invalid note id." }, { status: 400 });
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const existing = await findOne(id);
  if (!existing || existing.deletedAt || existing.clinicianId !== g.claims.uid)
    return NextResponse.json({ ok: false, error: "Note not found." }, { status: 404 });
  if (existing.status === "finalized")
    return NextResponse.json({ ok: false, error: "Finalized notes are immutable." }, { status: 409 });

  const next = { ...existing };
  if (typeof body.template === "string") next.template = body.template;
  if (body.subjective !== undefined) next.subjective = body.subjective?.toString().trim() || null;
  if (body.objective !== undefined) next.objective = body.objective?.toString().trim() || null;
  if (body.assessment !== undefined) next.assessment = body.assessment?.toString().trim() || null;
  if (body.plan !== undefined) next.plan = body.plan?.toString().trim() || null;
  if (body.body !== undefined) next.body = body.body?.toString().trim() || null;

  const finalize = body.status === "finalized";
  if (finalize) {
    if (!next.subjective && !next.objective && !next.assessment && !next.plan && !next.body) {
      return NextResponse.json(
        { ok: false, error: "Add content before finalizing the note." },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.$queryRaw<NoteRow[]>`
    UPDATE medical_records SET
      template     = ${next.template},
      subjective   = ${next.subjective},
      objective    = ${next.objective},
      assessment   = ${next.assessment},
      plan         = ${next.plan},
      body         = ${next.body},
      status       = ${finalize ? "finalized" : next.status},
      "finalizedAt" = ${finalize ? Prisma.sql`NOW()` : Prisma.sql`"finalizedAt"`},
      "updatedAt"  = NOW()
    WHERE id = ${id}::uuid
    RETURNING id, "patientId", "clinicianId", template, subjective, objective,
              assessment, plan, body, status, version,
              "createdAt", "updatedAt", "finalizedAt", "deletedAt",
              NULL::text AS "patientFirstName",
              NULL::text AS "patientLastName"
  `;
  const withPatient = await findOne(updated[0].id);
  return NextResponse.json({ ok: true, note: shape(withPatient!) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await guardClinician();
  if ("error" in g) return g.error;
  if (!UUID_RE.test(id))
    return NextResponse.json({ ok: false, error: "Invalid note id." }, { status: 400 });
  const existing = await findOne(id);
  if (!existing || existing.deletedAt || existing.clinicianId !== g.claims.uid)
    return NextResponse.json({ ok: false, error: "Note not found." }, { status: 404 });
  if (existing.status === "finalized")
    return NextResponse.json({ ok: false, error: "Finalized notes cannot be deleted." }, { status: 409 });
  await prisma.$executeRaw`
    UPDATE medical_records SET "deletedAt" = NOW(), "updatedAt" = NOW()
    WHERE id = ${id}::uuid
  `;
  return NextResponse.json({ ok: true });
}
