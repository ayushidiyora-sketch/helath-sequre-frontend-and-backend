import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const RELATIONSHIPS = new Set(["Spouse", "Child", "Parent", "Sibling", "Guardian", "Other"]);

interface Row {
  id: string;
  name: string;
  relationship: string;
  dob: Date | null;
  isMinor: boolean;
  canManageAccount: boolean;
  phone: string | null;
  email: string | null;
  notes: string | null;
  addedAt: Date;
}

function shape(r: Row) {
  return {
    id: r.id,
    name: r.name,
    relationship: r.relationship,
    dob: r.dob ? r.dob.toISOString().slice(0, 10) : "",
    isMinor: r.isMinor,
    canManageAccount: r.canManageAccount,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    notes: r.notes ?? undefined,
    addedAt: r.addedAt.toISOString(),
  };
}

async function guard() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) } as const;
  if (claims.role !== "Patient")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 }) } as const;
  if (!isDbUid(claims.uid))
    return { error: NextResponse.json({ ok: true, members: [] }) } as const;
  return { uid: claims.uid } as const;
}

interface Body {
  id?: string;
  name?: string;
  relationship?: string;
  dob?: string | null;
  isMinor?: boolean;
  canManageAccount?: boolean;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

function validate(body: Body): { error?: string; clean?: Required<Pick<Body, "name" | "relationship">> & Body } {
  const name = (body.name ?? "").trim();
  if (!name) return { error: "Name is required." };
  if (name.length > 200) return { error: "Name is too long." };
  const relationship = (body.relationship ?? "").trim();
  if (!RELATIONSHIPS.has(relationship)) return { error: "Invalid relationship." };
  return { clean: { ...body, name, relationship } };
}

export async function GET() {
  const g = await guard();
  if ("error" in g) return g.error;
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT id, name, relationship, dob, "isMinor", "canManageAccount",
           phone, email, notes, "addedAt"
    FROM family_members
    WHERE "patientId" = ${g.uid}::uuid
    ORDER BY "addedAt" DESC
  `;
  return NextResponse.json({ ok: true, members: rows.map(shape) });
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
  const dob = body.dob ? new Date(body.dob) : null;
  const inserted = await prisma.$queryRaw<Row[]>`
    INSERT INTO family_members
      (id, "patientId", name, relationship, dob, "isMinor", "canManageAccount",
       phone, email, notes, "addedAt", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), ${g.uid}::uuid, ${v.clean.name}, ${v.clean.relationship},
       ${dob}, ${!!body.isMinor}, ${!!body.canManageAccount},
       ${body.phone?.trim() || null}, ${body.email?.trim() || null}, ${body.notes?.trim() || null},
       NOW(), NOW(), NOW())
    RETURNING id, name, relationship, dob, "isMinor", "canManageAccount",
              phone, email, notes, "addedAt"
  `;
  return NextResponse.json({ ok: true, member: shape(inserted[0]) }, { status: 201 });
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
  const dob = body.dob ? new Date(body.dob) : null;
  const rows = await prisma.$queryRaw<Row[]>`
    UPDATE family_members SET
      name = ${v.clean.name},
      relationship = ${v.clean.relationship},
      dob = ${dob},
      "isMinor" = ${!!body.isMinor},
      "canManageAccount" = ${!!body.canManageAccount},
      phone = ${body.phone?.trim() || null},
      email = ${body.email?.trim() || null},
      notes = ${body.notes?.trim() || null},
      "updatedAt" = NOW()
    WHERE id = ${id}::uuid AND "patientId" = ${g.uid}::uuid
    RETURNING id, name, relationship, dob, "isMinor", "canManageAccount",
              phone, email, notes, "addedAt"
  `;
  if (rows.length === 0) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, member: shape(rows[0]) });
}

export async function DELETE(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  if (!isDbUid(id)) return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  await prisma.$executeRaw`
    DELETE FROM family_members
    WHERE id = ${id}::uuid AND "patientId" = ${g.uid}::uuid
  `;
  return NextResponse.json({ ok: true });
}
