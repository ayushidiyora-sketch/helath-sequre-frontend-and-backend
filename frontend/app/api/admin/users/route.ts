import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { Prisma, RoleKind, UserStatus } from "@prisma/client";
import { SESSION_COOKIE, signOnboardToken, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mailerConfigured, sendMail, welcomeEmail } from "@/lib/mail";
import { newJti, stashOnboardCred } from "@/lib/password-store";
import { staffSlug } from "@/lib/user-slug";

export const runtime = "nodejs";

// UI role labels accepted by POST. Maps to Prisma RoleKind.
// "Org Admin" is intentionally NOT in this map — those accounts are created
// by the Super Admin when provisioning a tenant, not from the org staff UI.
const UI_ROLE_MAP: Record<string, RoleKind> = {
  Clinician: RoleKind.clinician,
  "Care Team": RoleKind.clinician,
  "Compliance Manager": RoleKind.compliance_manager,
  Auditor: RoleKind.auditor,
};

// Reverse direction for GET output.
const ROLE_LABEL: Record<RoleKind, string> = {
  patient: "Patient",
  clinician: "Clinician",
  org_admin: "Org Admin",
  compliance_manager: "Compliance Manager",
  auditor: "Auditor",
  super_admin: "Super Admin",
};

type Guard =
  | { error: NextResponse; claims?: never }
  | { error?: never; claims: { uid: string; role: string; org: string; email: string; name: string } };

async function requireOrgAdmin(): Promise<Guard> {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) {
    return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) };
  }
  if (claims.role !== "Org Admin") {
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Org Admin only." }, { status: 403 }) };
  }
  if (!claims.org) {
    return { error: NextResponse.json({ ok: false, error: "No tenant on session" }, { status: 400 }) };
  }
  return { claims: { uid: claims.uid, role: claims.role, org: claims.org, email: claims.email, name: claims.name } };
}

async function loadOrgIdFromSlug(slug: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
  return org?.id ?? null;
}

function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digit = "23456789";
  const sym = "!@#$%^&*?-_";
  const all = upper + lower + digit + sym;
  const buf = randomBytes(16);
  const required = [
    upper[buf[0] % upper.length],
    lower[buf[1] % lower.length],
    digit[buf[2] % digit.length],
    sym[buf[3] % sym.length],
  ];
  const rest: string[] = [];
  for (let i = 4; i < 16; i++) rest.push(all[buf[i] % all.length]);
  const pool = [...required, ...rest];
  const shuf = randomBytes(pool.length);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = shuf[i] % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.join("");
}

interface PermissionsInput {
  canViewPatients?: boolean;
  canManageAppointments?: boolean;
  canAccessRecords?: boolean;
  canSendMessages?: boolean;
}

interface CreateStaffBody {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: string;

  // Extended profile (all optional)
  employeeId?: string;
  dateOfBirth?: string; // ISO date yyyy-mm-dd
  gender?: string;
  profilePhotoUrl?: string;
  department?: string;
  designation?: string;
  accessLevel?: string;
  reportingTo?: string;
  joiningDate?: string;
  employmentType?: string;
  shift?: string;
  workLocation?: string;
  permissions?: PermissionsInput;
  mfaRequired?: boolean;
}

interface PublicStaff {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
  status: UserStatus;
  invitation: "pending" | "accepted";
  profilePhotoUrl: string | null;
  employeeId: string | null;
  department: string | null;
  designation: string | null;
  accessLevel: string | null;
  reportingTo: string | null;
  joiningDate: string | null;
  employmentType: string | null;
  shift: string | null;
  workLocation: string | null;
  permissions: Record<string, boolean>;
  mfaRequired: boolean;
  createdAt: string;
}

function shape(u: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  roleKind: RoleKind;
  status: UserStatus;
  profilePhotoUrl: string | null;
  employeeId: string | null;
  department: string | null;
  designation: string | null;
  accessLevel: string | null;
  reportingTo: string | null;
  joiningDate: Date | null;
  employmentType: string | null;
  shift: string | null;
  workLocation: string | null;
  permissions: unknown;
  mfaRequired: boolean;
  createdAt: Date;
}): PublicStaff {
  return {
    id: u.id,
    slug: staffSlug(u),
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    phone: u.phone,
    role: ROLE_LABEL[u.roleKind] ?? u.roleKind,
    status: u.status,
    invitation: u.status === UserStatus.invited ? "pending" : "accepted",
    profilePhotoUrl: u.profilePhotoUrl,
    employeeId: u.employeeId,
    department: u.department,
    designation: u.designation,
    accessLevel: u.accessLevel,
    reportingTo: u.reportingTo,
    joiningDate: u.joiningDate ? u.joiningDate.toISOString().slice(0, 10) : null,
    employmentType: u.employmentType,
    shift: u.shift,
    workLocation: u.workLocation,
    permissions: (u.permissions as Record<string, boolean>) ?? {},
    mfaRequired: u.mfaRequired,
    createdAt: u.createdAt.toISOString(),
  };
}

export async function GET() {
  const guard = await requireOrgAdmin();
  if (guard.error) return guard.error;
  const orgId = await loadOrgIdFromSlug(guard.claims.org);
  if (!orgId) return NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 });

  const rows = await prisma.user.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      // Org admins are managed by Super Admin and intentionally omitted from
      // the staff list — Org Admin sees only their team (clinicians / etc.).
      roleKind: { in: [RoleKind.clinician, RoleKind.compliance_manager, RoleKind.auditor] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      roleKind: true,
      status: true,
      profilePhotoUrl: true,
      employeeId: true,
      department: true,
      designation: true,
      accessLevel: true,
      reportingTo: true,
      joiningDate: true,
      employmentType: true,
      shift: true,
      workLocation: true,
      permissions: true,
      mfaRequired: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ ok: true, staff: rows.map(shape) });
}

export async function POST(req: Request) {
  const guard = await requireOrgAdmin();
  if (guard.error) return guard.error;
  const orgSlug = guard.claims.org;
  const orgId = await loadOrgIdFromSlug(orgSlug);
  if (!orgId) return NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 });

  let body: CreateStaffBody;
  try {
    body = (await req.json()) as CreateStaffBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const firstName = body.firstName?.trim() ?? "";
  const lastName = body.lastName?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const phone = body.phone?.trim() || null;
  const roleLabel = body.role?.trim() ?? "";

  if (!firstName || !lastName) {
    return NextResponse.json({ ok: false, error: "First and last name are required." }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "A valid email is required." }, { status: 400 });
  }
  const roleKind = UI_ROLE_MAP[roleLabel];
  if (!roleKind) {
    return NextResponse.json(
      { ok: false, error: `Role must be one of: ${Object.keys(UI_ROLE_MAP).join(", ")}` },
      { status: 400 },
    );
  }

  // Unique-email guard (the DB also enforces it).
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json(
      { ok: false, error: `An account with email "${email}" already exists.` },
      { status: 409 },
    );
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  // Auto-generate the next Employee ID per tenant if the caller didn't
  // supply one. Format: EMP-001 (3-digit zero-padded). Falls back to a
  // longer width when the tenant exceeds 999 employees.
  async function nextEmployeeId(): Promise<string> {
    const existing = await prisma.user.findMany({
      where: { organizationId: orgId, employeeId: { startsWith: "EMP-" } },
      select: { employeeId: true },
    });
    let max = 0;
    for (const r of existing) {
      const m = /^EMP-(\d+)$/.exec(r.employeeId ?? "");
      if (m) {
        const n = Number(m[1]);
        if (n > max) max = n;
      }
    }
    const next = max + 1;
    return `EMP-${next.toString().padStart(3, "0")}`;
  }
  const finalEmployeeId =
    body.employeeId?.trim() && body.employeeId.trim().length > 0
      ? body.employeeId.trim()
      : await nextEmployeeId();

  // Build the optional extended-profile payload. Empty strings are treated
  // as "not provided" so the column stays null.
  const opt = (v: string | undefined): string | null => {
    const t = v?.trim();
    return t ? t : null;
  };
  const optDate = (v: string | undefined): Date | null => {
    const t = v?.trim();
    if (!t) return null;
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const permissions = {
    canViewPatients: !!body.permissions?.canViewPatients,
    canManageAppointments: !!body.permissions?.canManageAppointments,
    canAccessRecords: !!body.permissions?.canAccessRecords,
    canSendMessages: !!body.permissions?.canSendMessages,
  };

  const created = await prisma.user.create({
    data: {
      organizationId: orgId,
      email,
      passwordHash,
      firstName,
      lastName,
      phone: phone ?? undefined,
      roleKind,
      status: UserStatus.invited,
      employeeId: finalEmployeeId,
      dateOfBirth: optDate(body.dateOfBirth) ?? undefined,
      gender: opt(body.gender) ?? undefined,
      profilePhotoUrl: opt(body.profilePhotoUrl) ?? undefined,
      department: opt(body.department) ?? undefined,
      designation: opt(body.designation) ?? undefined,
      accessLevel: opt(body.accessLevel) ?? undefined,
      reportingTo: opt(body.reportingTo) ?? undefined,
      joiningDate: optDate(body.joiningDate) ?? undefined,
      employmentType: opt(body.employmentType) ?? undefined,
      shift: opt(body.shift) ?? undefined,
      workLocation: opt(body.workLocation) ?? undefined,
      permissions: permissions as Prisma.InputJsonValue,
      mfaRequired: body.mfaRequired !== false,
    },
    include: { organization: { select: { name: true } } },
  });

  // One-time onboarding token so the welcome email lands on a pre-filled
  // staff-login form. Mirrors the org-admin invite flow in /api/super/tenants.
  const onboardJti = newJti();
  stashOnboardCred(onboardJti, tempPassword);
  const onboardToken = await signOnboardToken({
    uid: created.id,
    email: created.email,
    jti: onboardJti,
  });
  const origin = new URL(req.url).origin;
  const loginUrl = `${origin}/staff-login?onboard=${encodeURIComponent(onboardToken)}`;

  let mailSent = false;
  let mailVia: string | undefined;
  let mailError: string | undefined;
  let mailAttempts: { via: string; outcome: string; error?: string }[] = [];
  if (mailerConfigured()) {
    const { subject, text, html } = welcomeEmail({
      name: `${firstName} ${lastName}`,
      tenantName: created.organization?.name ?? "your organization",
      email,
      password: tempPassword,
      loginUrl,
    });
    const result = await sendMail({ to: email, subject, text, html });
    mailSent = result.ok;
    mailVia = result.via;
    mailAttempts = result.attempts ?? [];
    if (!result.ok) {
      mailError = result.error;
      console.error(`[admin/users] welcome mail failed (last via ${result.via}): ${result.error}`);
    } else {
      console.log(`[admin/users] welcome mail sent via ${result.via} to ${email}`);
    }
  }

  return NextResponse.json(
    {
      ok: true,
      staff: shape({
        id: created.id,
        firstName: created.firstName,
        lastName: created.lastName,
        email: created.email,
        phone: created.phone,
        roleKind: created.roleKind,
        status: created.status,
        profilePhotoUrl: created.profilePhotoUrl,
        employeeId: created.employeeId,
        department: created.department,
        designation: created.designation,
        accessLevel: created.accessLevel,
        reportingTo: created.reportingTo,
        joiningDate: created.joiningDate,
        employmentType: created.employmentType,
        shift: created.shift,
        workLocation: created.workLocation,
        permissions: created.permissions,
        mfaRequired: created.mfaRequired,
        createdAt: created.createdAt,
      }),
      mailSent,
      mailVia,
      mailAttempts,
      ...(mailSent
        ? {}
        : {
            mailError,
            devCredentials: { email, password: tempPassword, loginUrl },
          }),
    },
    { status: 201 },
  );
}
