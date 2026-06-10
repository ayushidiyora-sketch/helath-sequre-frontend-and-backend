import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * The signed-in clinician's own profile (Settings → Profile). DB-backed so the
 * form reflects the real `users` row instead of the demo store.
 *
 *   GET   → { ok, profile }
 *   PATCH → update editable fields (firstName, lastName, phone, department,
 *           designation). Email + organization are read-only here.
 */

interface ProfileRow {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  department: string | null;
  designation: string | null;
  profilePhotoUrl: string | null;
  orgName: string | null;
}

function shape(r: ProfileRow) {
  return {
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    phone: r.phone ?? "",
    department: r.department ?? "",
    designation: r.designation ?? "",
    profilePhotoUrl: r.profilePhotoUrl,
    organization: r.orgName ?? "",
  };
}

async function guard() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) } as const;
  if (claims.role !== "Clinician")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Clinician only." }, { status: 403 }) } as const;
  if (!isDbUid(claims.uid))
    return { error: NextResponse.json({ ok: false, error: "Demo session — profile requires a real account." }, { status: 400 }) } as const;
  return { uid: claims.uid } as const;
}

async function load(uid: string): Promise<ProfileRow | null> {
  const rows = await prisma.$queryRaw<ProfileRow[]>`
    SELECT u."firstName", u."lastName", u.email, u.phone, u.department, u.designation,
           u."profilePhotoUrl", o.name AS "orgName"
    FROM users u
    LEFT JOIN organizations o ON o.id = u."organizationId"
    WHERE u.id = ${uid}::uuid AND u."deletedAt" IS NULL
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function GET() {
  const g = await guard();
  if ("error" in g) return g.error;
  const row = await load(g.uid);
  if (!row) return NextResponse.json({ ok: false, error: "Profile not found." }, { status: 404 });
  return NextResponse.json({ ok: true, profile: shape(row) });
}

interface PatchBody {
  firstName?: string;
  lastName?: string;
  phone?: string;
  department?: string;
  designation?: string;
}

function validName(v: string): string | null {
  const t = v.trim();
  if (t.length < 2) return "Must be at least 2 characters.";
  if (t.length > 15) return "Must be 15 characters or fewer.";
  return null;
}

export async function PATCH(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const firstName = (body.firstName ?? "").trim();
  const lastName = (body.lastName ?? "").trim();
  const fErr = validName(firstName);
  const lErr = validName(lastName);
  if (fErr) return NextResponse.json({ ok: false, error: `First name: ${fErr}` }, { status: 400 });
  if (lErr) return NextResponse.json({ ok: false, error: `Last name: ${lErr}` }, { status: 400 });

  const phone = (body.phone ?? "").trim() || null;
  const department = (body.department ?? "").trim() || null;
  const designation = (body.designation ?? "").trim() || null;

  await prisma.$executeRaw`
    UPDATE users
    SET "firstName" = ${firstName}, "lastName" = ${lastName},
        phone = ${phone}, department = ${department}, designation = ${designation},
        "updatedAt" = NOW()
    WHERE id = ${g.uid}::uuid
  `;

  const row = await load(g.uid);
  if (!row) return NextResponse.json({ ok: false, error: "Profile not found." }, { status: 404 });
  return NextResponse.json({ ok: true, profile: shape(row) });
}
