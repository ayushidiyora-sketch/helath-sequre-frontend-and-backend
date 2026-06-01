import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma, RoleKind, UserStatus } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractUid, staffSlug } from "@/lib/user-slug";

export const runtime = "nodejs";

// Role labels — same mapping the list route uses. Org Admin intentionally
// not editable from this endpoint (handled by Super Admin elsewhere).
const UI_ROLE_MAP: Record<string, RoleKind> = {
  Clinician: RoleKind.clinician,
  "Care Team": RoleKind.clinician,
  "Compliance Manager": RoleKind.compliance_manager,
  Auditor: RoleKind.auditor,
};
const ROLE_LABEL: Record<RoleKind, string> = {
  patient: "Patient",
  clinician: "Clinician",
  org_admin: "Org Admin",
  compliance_manager: "Compliance Manager",
  auditor: "Auditor",
  super_admin: "Super Admin",
};

interface PermissionsInput {
  canViewPatients?: boolean;
  canManageAppointments?: boolean;
  canAccessRecords?: boolean;
  canSendMessages?: boolean;
}

interface PatchBody {
  // Status / lifecycle
  status?: string;
  forcePasswordReset?: boolean;
  // Profile
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  role?: string;
  employeeId?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  profilePhotoUrl?: string | null;
  department?: string | null;
  designation?: string | null;
  accessLevel?: string | null;
  reportingTo?: string | null;
  joiningDate?: string | null;
  employmentType?: string | null;
  shift?: string | null;
  workLocation?: string | null;
  permissions?: PermissionsInput;
  mfaRequired?: boolean;
}

const ALLOWED_STATUSES: UserStatus[] = [
  UserStatus.active,
  UserStatus.invited,
  UserStatus.suspended,
  UserStatus.deactivated,
];

async function requireOrgAdminFor(idOrSlug: string) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) };
  if (claims.role !== "Org Admin")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Org Admin only." }, { status: 403 }) };
  if (!claims.org)
    return { error: NextResponse.json({ ok: false, error: "No tenant on session" }, { status: 400 }) };

  // The URL param may be a plain UUID OR a slug like
  // "priya-shah-bd27c110-…". Pull the UUID out and resolve from there.
  const uuid = extractUid(idOrSlug);
  if (!uuid) {
    return { error: NextResponse.json({ ok: false, error: "Invalid staff identifier." }, { status: 400 }) };
  }
  // Make sure the target staff belongs to the same tenant.
  const target = await prisma.user.findUnique({
    where: { id: uuid },
    select: { id: true, organization: { select: { slug: true } } },
  });
  if (!target || target.organization?.slug !== claims.org) {
    return { error: NextResponse.json({ ok: false, error: "Staff not found in this tenant." }, { status: 404 }) };
  }
  return { claims, staffId: target.id };
}

const FULL_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  roleKind: true,
  status: true,
  employeeId: true,
  dateOfBirth: true,
  gender: true,
  profilePhotoUrl: true,
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
  lastLoginAt: true,
} as const;

type FullUserRow = Prisma.UserGetPayload<{ select: typeof FULL_SELECT }>;

function shape(u: FullUserRow) {
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
    employeeId: u.employeeId,
    dateOfBirth: u.dateOfBirth ? u.dateOfBirth.toISOString().slice(0, 10) : null,
    gender: u.gender,
    profilePhotoUrl: u.profilePhotoUrl,
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
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const guard = await requireOrgAdminFor(id);
  if ("error" in guard && guard.error) return guard.error;
  const staffId = (guard as { staffId: string }).staffId;

  const row = await prisma.user.findUnique({ where: { id: staffId }, select: FULL_SELECT });
  if (!row) return NextResponse.json({ ok: false, error: "Staff not found." }, { status: 404 });
  return NextResponse.json({ ok: true, staff: shape(row) });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const guard = await requireOrgAdminFor(id);
  if ("error" in guard && guard.error) return guard.error;
  const staffId = (guard as { staffId: string }).staffId;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const data: Prisma.UserUpdateInput = {};

  // --- Lifecycle ---
  if (body.status !== undefined) {
    if (!ALLOWED_STATUSES.includes(body.status as UserStatus)) {
      return NextResponse.json(
        { ok: false, error: `Status must be one of: ${ALLOWED_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }
    data.status = body.status as UserStatus;
    if (body.status === UserStatus.active) {
      data.failedLoginCount = 0;
      data.lockedUntil = null;
    }
  }
  if (body.forcePasswordReset === true) {
    data.status = UserStatus.invited;
  }

  // --- Profile (each field independently optional) ---
  const setStr = (key: keyof Prisma.UserUpdateInput, v: string | null | undefined) => {
    if (v === undefined) return;
    const t = typeof v === "string" ? v.trim() : v;
    // Empty string clears the column (matches the form's empty-input semantics).
    (data as Record<string, unknown>)[key as string] = t === "" || t === null ? null : t;
  };
  const setDate = (key: keyof Prisma.UserUpdateInput, v: string | null | undefined) => {
    if (v === undefined) return;
    if (v === null || v === "") {
      (data as Record<string, unknown>)[key as string] = null;
      return;
    }
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      (data as Record<string, unknown>)[key as string] = d;
    }
  };

  if (body.firstName !== undefined) {
    const t = body.firstName.trim();
    if (!t) return NextResponse.json({ ok: false, error: "First name cannot be empty." }, { status: 400 });
    data.firstName = t;
  }
  if (body.lastName !== undefined) {
    const t = body.lastName.trim();
    if (!t) return NextResponse.json({ ok: false, error: "Last name cannot be empty." }, { status: 400 });
    data.lastName = t;
  }
  setStr("phone", body.phone);
  if (body.role !== undefined) {
    const kind = UI_ROLE_MAP[body.role];
    if (!kind) {
      return NextResponse.json(
        { ok: false, error: `Role must be one of: ${Object.keys(UI_ROLE_MAP).join(", ")}` },
        { status: 400 },
      );
    }
    data.roleKind = kind;
  }
  // employeeId is intentionally NOT updatable — it's the immutable HR ID
  // assigned at invite time. Tampered requests that include it are ignored.
  setDate("dateOfBirth", body.dateOfBirth);
  setStr("gender", body.gender);
  setStr("profilePhotoUrl", body.profilePhotoUrl);
  setStr("department", body.department);
  setStr("designation", body.designation);
  setStr("accessLevel", body.accessLevel);
  setStr("reportingTo", body.reportingTo);
  setDate("joiningDate", body.joiningDate);
  setStr("employmentType", body.employmentType);
  setStr("shift", body.shift);
  setStr("workLocation", body.workLocation);
  if (body.permissions !== undefined) {
    data.permissions = {
      canViewPatients: !!body.permissions.canViewPatients,
      canManageAppointments: !!body.permissions.canManageAppointments,
      canAccessRecords: !!body.permissions.canAccessRecords,
      canSendMessages: !!body.permissions.canSendMessages,
    } as Prisma.InputJsonValue;
  }
  if (body.mfaRequired !== undefined) data.mfaRequired = !!body.mfaRequired;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "No fields to update." }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({ where: { id: staffId }, data, select: FULL_SELECT });
    return NextResponse.json({ ok: true, staff: shape(updated) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ ok: false, error: "Staff not found." }, { status: 404 });
    }
    throw err;
  }
}
