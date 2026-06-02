import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const BLOOD_GROUPS = new Set(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"]);

interface Row {
  primaryName: string;
  primaryRelationship: string;
  primaryPhone: string;
  secondaryName: string | null;
  secondaryRelationship: string | null;
  secondaryPhone: string | null;
  bloodGroup: string;
  allergies: Prisma.JsonValue;
  criticalMedications: Prisma.JsonValue;
  medicalIds: Prisma.JsonValue;
  organDonor: boolean;
  preferredHospital: string | null;
  updatedAt: Date;
}

interface MedicalId { label: string; value: string }

function readStringArray(raw: Prisma.JsonValue): string[] {
  return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === "string") : [];
}
function readMedicalIds(raw: Prisma.JsonValue): MedicalId[] {
  if (!Array.isArray(raw)) return [];
  const out: MedicalId[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const o = m as { label?: unknown; value?: unknown };
    if (typeof o.label === "string" && typeof o.value === "string") {
      out.push({ label: o.label, value: o.value });
    }
  }
  return out;
}
function shape(r: Row | null) {
  return {
    primaryName: r?.primaryName ?? "",
    primaryRelationship: r?.primaryRelationship ?? "",
    primaryPhone: r?.primaryPhone ?? "",
    secondaryName: r?.secondaryName ?? "",
    secondaryRelationship: r?.secondaryRelationship ?? "",
    secondaryPhone: r?.secondaryPhone ?? "",
    bloodGroup: (r?.bloodGroup ?? "Unknown"),
    allergies: r ? readStringArray(r.allergies) : [],
    criticalMedications: r ? readStringArray(r.criticalMedications) : [],
    medicalIds: r ? readMedicalIds(r.medicalIds) : [],
    organDonor: r?.organDonor ?? false,
    preferredHospital: r?.preferredHospital ?? "",
    updatedAt: r ? r.updatedAt.toISOString() : new Date().toISOString(),
  };
}

async function guard() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) } as const;
  if (claims.role !== "Patient")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 }) } as const;
  if (!isDbUid(claims.uid))
    return { error: NextResponse.json({ ok: true, emergency: shape(null) }) } as const;
  return { uid: claims.uid } as const;
}

export async function GET() {
  const g = await guard();
  if ("error" in g) return g.error;
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT "primaryName", "primaryRelationship", "primaryPhone",
           "secondaryName", "secondaryRelationship", "secondaryPhone",
           "bloodGroup", allergies, "criticalMedications", "medicalIds",
           "organDonor", "preferredHospital", "updatedAt"
    FROM patient_emergency
    WHERE "patientId" = ${g.uid}::uuid
    LIMIT 1
  `;
  return NextResponse.json({ ok: true, emergency: shape(rows[0] ?? null) });
}

interface Body {
  primaryName?: string;
  primaryRelationship?: string;
  primaryPhone?: string;
  secondaryName?: string | null;
  secondaryRelationship?: string | null;
  secondaryPhone?: string | null;
  bloodGroup?: string;
  allergies?: string[];
  criticalMedications?: string[];
  medicalIds?: MedicalId[];
  organDonor?: boolean;
  preferredHospital?: string | null;
}

export async function PUT(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  let body: Body;
  try { body = (await req.json()) as Body; } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const bg = body.bloodGroup && BLOOD_GROUPS.has(body.bloodGroup) ? body.bloodGroup : "Unknown";
  const allergies = JSON.stringify(Array.isArray(body.allergies) ? body.allergies.filter((s) => typeof s === "string").slice(0, 50) : []);
  const meds = JSON.stringify(Array.isArray(body.criticalMedications) ? body.criticalMedications.filter((s) => typeof s === "string").slice(0, 50) : []);
  const ids = JSON.stringify(Array.isArray(body.medicalIds) ? body.medicalIds.filter((m): m is MedicalId => !!m && typeof m.label === "string" && typeof m.value === "string").slice(0, 20) : []);

  await prisma.$executeRaw`
    INSERT INTO patient_emergency
      (id, "patientId", "primaryName", "primaryRelationship", "primaryPhone",
       "secondaryName", "secondaryRelationship", "secondaryPhone",
       "bloodGroup", allergies, "criticalMedications", "medicalIds",
       "organDonor", "preferredHospital", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), ${g.uid}::uuid,
       ${body.primaryName?.trim() ?? ""}, ${body.primaryRelationship?.trim() ?? ""}, ${body.primaryPhone?.trim() ?? ""},
       ${body.secondaryName?.trim() || null}, ${body.secondaryRelationship?.trim() || null}, ${body.secondaryPhone?.trim() || null},
       ${bg}, ${allergies}::jsonb, ${meds}::jsonb, ${ids}::jsonb,
       ${!!body.organDonor}, ${body.preferredHospital?.trim() || null}, NOW(), NOW())
    ON CONFLICT ("patientId") DO UPDATE SET
      "primaryName"           = EXCLUDED."primaryName",
      "primaryRelationship"   = EXCLUDED."primaryRelationship",
      "primaryPhone"          = EXCLUDED."primaryPhone",
      "secondaryName"         = EXCLUDED."secondaryName",
      "secondaryRelationship" = EXCLUDED."secondaryRelationship",
      "secondaryPhone"        = EXCLUDED."secondaryPhone",
      "bloodGroup"            = EXCLUDED."bloodGroup",
      allergies               = EXCLUDED.allergies,
      "criticalMedications"   = EXCLUDED."criticalMedications",
      "medicalIds"            = EXCLUDED."medicalIds",
      "organDonor"            = EXCLUDED."organDonor",
      "preferredHospital"     = EXCLUDED."preferredHospital",
      "updatedAt"             = NOW()
  `;

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT "primaryName", "primaryRelationship", "primaryPhone",
           "secondaryName", "secondaryRelationship", "secondaryPhone",
           "bloodGroup", allergies, "criticalMedications", "medicalIds",
           "organDonor", "preferredHospital", "updatedAt"
    FROM patient_emergency WHERE "patientId" = ${g.uid}::uuid LIMIT 1
  `;
  return NextResponse.json({ ok: true, emergency: shape(rows[0] ?? null) });
}
