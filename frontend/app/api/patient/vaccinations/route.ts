import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface Row {
  id: string;
  vaccine: string;
  manufacturer: string | null;
  doseNumber: number;
  totalDoses: number | null;
  administeredOn: Date;
  administeredBy: string | null;
  lotNumber: string | null;
  nextDoseDue: Date | null;
  certificateFileName: string | null;
  forTravel: boolean;
  notes: string | null;
}

function shape(r: Row) {
  return {
    id: r.id,
    vaccine: r.vaccine,
    manufacturer: r.manufacturer ?? undefined,
    doseNumber: r.doseNumber,
    totalDoses: r.totalDoses ?? undefined,
    administeredOn: r.administeredOn.toISOString().slice(0, 10),
    administeredBy: r.administeredBy ?? undefined,
    lotNumber: r.lotNumber ?? undefined,
    nextDoseDue: r.nextDoseDue ? r.nextDoseDue.toISOString().slice(0, 10) : undefined,
    certificateFileName: r.certificateFileName ?? undefined,
    forTravel: r.forTravel,
    notes: r.notes ?? undefined,
  };
}

async function guard() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) } as const;
  if (claims.role !== "Patient")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 }) } as const;
  if (!isDbUid(claims.uid))
    return { error: NextResponse.json({ ok: true, vaccinations: [] }) } as const;
  return { uid: claims.uid } as const;
}

interface Body {
  id?: string;
  vaccine?: string;
  manufacturer?: string | null;
  doseNumber?: number;
  totalDoses?: number | null;
  administeredOn?: string;
  administeredBy?: string | null;
  lotNumber?: string | null;
  nextDoseDue?: string | null;
  forTravel?: boolean;
  notes?: string | null;
}

function validate(body: Body) {
  const vaccine = (body.vaccine ?? "").trim();
  if (!vaccine) return { error: "Vaccine name is required." };
  const administered = body.administeredOn ? new Date(body.administeredOn) : null;
  if (!administered || Number.isNaN(administered.getTime())) return { error: "Invalid administered-on date." };
  const dose = Number.isFinite(body.doseNumber) ? Math.max(1, Math.min(20, Number(body.doseNumber))) : 1;
  const total = Number.isFinite(body.totalDoses) ? Math.max(1, Math.min(20, Number(body.totalDoses))) : null;
  const next = body.nextDoseDue ? new Date(body.nextDoseDue) : null;
  if (next && Number.isNaN(next.getTime())) return { error: "Invalid next-dose-due date." };
  return { clean: { vaccine, administered, dose, total, next } };
}

export async function GET() {
  const g = await guard();
  if ("error" in g) return g.error;
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT id, vaccine, manufacturer, "doseNumber", "totalDoses",
           "administeredOn", "administeredBy", "lotNumber", "nextDoseDue",
           "certificateFileName", "forTravel", notes
    FROM vaccination_records
    WHERE "patientId" = ${g.uid}::uuid
    ORDER BY "administeredOn" DESC
  `;
  return NextResponse.json({ ok: true, vaccinations: rows.map(shape) });
}

export async function POST(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  let body: Body;
  try { body = (await req.json()) as Body; } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const v = validate(body);
  if (v.error || !v.clean) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
  const rows = await prisma.$queryRaw<Row[]>`
    INSERT INTO vaccination_records
      (id, "patientId", vaccine, manufacturer, "doseNumber", "totalDoses",
       "administeredOn", "administeredBy", "lotNumber", "nextDoseDue",
       "forTravel", notes, "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), ${g.uid}::uuid, ${v.clean.vaccine},
       ${body.manufacturer?.trim() || null}, ${v.clean.dose}, ${v.clean.total},
       ${v.clean.administered}, ${body.administeredBy?.trim() || null}, ${body.lotNumber?.trim() || null}, ${v.clean.next},
       ${!!body.forTravel}, ${body.notes?.trim() || null}, NOW(), NOW())
    RETURNING id, vaccine, manufacturer, "doseNumber", "totalDoses",
              "administeredOn", "administeredBy", "lotNumber", "nextDoseDue",
              "certificateFileName", "forTravel", notes
  `;
  return NextResponse.json({ ok: true, vaccination: shape(rows[0]) }, { status: 201 });
}

export async function PATCH(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  let body: Body;
  try { body = (await req.json()) as Body; } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const id = body.id?.trim() ?? "";
  if (!isDbUid(id)) return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  const v = validate(body);
  if (v.error || !v.clean) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
  const rows = await prisma.$queryRaw<Row[]>`
    UPDATE vaccination_records SET
      vaccine = ${v.clean.vaccine},
      manufacturer = ${body.manufacturer?.trim() || null},
      "doseNumber" = ${v.clean.dose},
      "totalDoses" = ${v.clean.total},
      "administeredOn" = ${v.clean.administered},
      "administeredBy" = ${body.administeredBy?.trim() || null},
      "lotNumber" = ${body.lotNumber?.trim() || null},
      "nextDoseDue" = ${v.clean.next},
      "forTravel" = ${!!body.forTravel},
      notes = ${body.notes?.trim() || null},
      "updatedAt" = NOW()
    WHERE id = ${id}::uuid AND "patientId" = ${g.uid}::uuid
    RETURNING id, vaccine, manufacturer, "doseNumber", "totalDoses",
              "administeredOn", "administeredBy", "lotNumber", "nextDoseDue",
              "certificateFileName", "forTravel", notes
  `;
  if (rows.length === 0) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, vaccination: shape(rows[0]) });
}

export async function DELETE(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  if (!isDbUid(id)) return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  await prisma.$executeRaw`
    DELETE FROM vaccination_records
    WHERE id = ${id}::uuid AND "patientId" = ${g.uid}::uuid
  `;
  return NextResponse.json({ ok: true });
}
