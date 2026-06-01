import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma, RoleKind, TenantType } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const TIER_LABEL: Record<string, string> = {
  basic: "Basic",
  pro: "Pro",
  enterprise: "Enterprise",
};
const TYPE_LABEL: Record<string, string> = {
  clinic: "Clinic",
  hospital: "Hospital",
  telemedicine: "Telemedicine",
  diagnostic: "Diagnostic",
};
// Form label → DB enum value mapping for PATCH.
const TYPE_FROM_LABEL: Record<string, TenantType> = {
  Hospital: TenantType.hospital,
  Clinic: TenantType.clinic,
  Telemedicine: TenantType.telemedicine,
  Diagnostic: TenantType.diagnostic,
};

interface TenantSettingsContact {
  email?: string;
  phone?: string;
  address?: string;
}

interface TenantSettingsBranding {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

interface TenantSettings {
  contact?: TenantSettingsContact;
  branding?: TenantSettingsBranding;
  // Other settings (integrations, retention, etc.) live alongside.
  [k: string]: unknown;
}

function readSettings(raw: Prisma.JsonValue | null): TenantSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as TenantSettings;
}

async function loadGuardedOrg(
  allowSuperAdmin: boolean,
): Promise<
  | { error: NextResponse; org?: never }
  | {
      error?: never;
      org: Awaited<ReturnType<typeof loadOrgWithCounts>>;
    }
> {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) };
  const allowed =
    claims.role === "Org Admin" || (allowSuperAdmin && claims.role === "Super Admin");
  if (!allowed) return { error: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  if (!claims.org) return { error: NextResponse.json({ ok: false, error: "No tenant on session" }, { status: 400 }) };
  const org = await loadOrgWithCounts(claims.org);
  if (!org || org.archivedAt) return { error: NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 }) };
  return { org };
}

async function loadOrgWithCounts(slug: string) {
  return prisma.organization.findUnique({
    where: { slug },
    include: {
      _count: {
        select: {
          users: { where: { deletedAt: null } },
          departments: { where: { deletedAt: null } },
        },
      },
      users: {
        where: { deletedAt: null },
        select: { roleKind: true, status: true },
      },
    },
  });
}

async function findOrgAdminContact(orgId: string): Promise<{ email: string | null; phone: string | null }> {
  const admin = await prisma.user.findFirst({
    where: {
      organizationId: orgId,
      roleKind: RoleKind.org_admin,
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
    select: { email: true, phone: true },
  });
  return { email: admin?.email ?? null, phone: admin?.phone ?? null };
}

async function shapeTenant(org: NonNullable<Awaited<ReturnType<typeof loadOrgWithCounts>>>) {
  const settings = readSettings(org.settings);
  const contact = settings.contact ?? {};
  const branding = settings.branding ?? {};
  // Default the contact email/phone to the first Org Admin in this tenant so
  // freshly-provisioned organizations don't show empty fields. Once the admin
  // saves an override via PATCH, that value persists in settings.contact.
  const fallback = await findOrgAdminContact(org.id);
  return {
    id: org.slug,
    name: org.name,
    type: TYPE_LABEL[org.type] ?? org.type,
    typeKind: org.type,
    tier: TIER_LABEL[org.tier] ?? org.tier,
    region: org.region,
    status: org.status,
    multiAz: org.multiAzEnabled,
    crossRegionS3: org.crossRegionS3,
    createdAt: org.createdAt.toISOString(),
    contact: {
      email: contact.email || fallback.email || "",
      phone: contact.phone || fallback.phone || "",
      address: contact.address ?? "",
    },
    branding: {
      logoUrl: branding.logoUrl ?? "",
      primaryColor: branding.primaryColor ?? "#0E7490",
      secondaryColor: branding.secondaryColor ?? "#FFFFFF",
    },
  };
}


function deriveCounts(org: NonNullable<Awaited<ReturnType<typeof loadOrgWithCounts>>>) {
  const counts = { staff: 0, clinicians: 0, patients: 0, admins: 0, pendingInvites: 0 };
  for (const u of org.users) {
    if (u.roleKind === RoleKind.patient) counts.patients += 1;
    else if (u.roleKind === RoleKind.org_admin) counts.admins += 1;
    else counts.staff += 1;
    if (u.roleKind === RoleKind.clinician) counts.clinicians += 1;
    if (u.status === "invited") counts.pendingInvites += 1;
  }
  return {
    totalUsers: org._count.users,
    ...counts,
    departments: org._count.departments,
  };
}

/**
 * Returns the signed-in org admin's tenant plus live counts so the admin
 * dashboard can render real data (subscription tier, multi-AZ, staff count,
 * department count, ...) instead of the hardcoded "Enterprise · 64 staff"
 * placeholder. Also exposes settings.contact so the Organization Profile tab
 * can edit email/phone/address.
 */
export async function GET() {
  const g = await loadGuardedOrg(true);
  if (g.error) return g.error;
  return NextResponse.json({
    ok: true,
    tenant: await shapeTenant(g.org!),
    counts: deriveCounts(g.org!),
  });
}

interface PatchBody {
  name?: string;
  type?: string;
  contact?: TenantSettingsContact;
  branding?: TenantSettingsBranding;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const MAX_LOGO_BYTES = 1_500_000; // ~1.5 MB after base64 inflation = ~1 MB raw

export async function PATCH(req: Request) {
  const g = await loadGuardedOrg(false);
  if (g.error) return g.error;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const data: { name?: string; type?: TenantType; settings?: Prisma.InputJsonValue } = {};

  if (typeof body.name === "string") {
    const v = body.name.trim();
    if (!v) return NextResponse.json({ ok: false, error: "Organization name is required." }, { status: 400 });
    data.name = v;
  }
  if (typeof body.type === "string") {
    const mapped = TYPE_FROM_LABEL[body.type];
    if (!mapped) {
      return NextResponse.json(
        { ok: false, error: `Type must be one of: ${Object.keys(TYPE_FROM_LABEL).join(", ")}` },
        { status: 400 },
      );
    }
    data.type = mapped;
  }
  const existing = readSettings(g.org!.settings);
  let nextSettings: TenantSettings | null = null;
  if (body.contact) {
    const nextContact: TenantSettingsContact = {
      email: typeof body.contact.email === "string" ? body.contact.email.trim() : existing.contact?.email,
      phone: typeof body.contact.phone === "string" ? body.contact.phone.trim() : existing.contact?.phone,
      address:
        typeof body.contact.address === "string" ? body.contact.address.trim() : existing.contact?.address,
    };
    if (nextContact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextContact.email)) {
      return NextResponse.json({ ok: false, error: "Contact email is invalid." }, { status: 400 });
    }
    nextSettings = { ...(nextSettings ?? existing), contact: nextContact };
  }
  if (body.branding) {
    const existingBranding = (nextSettings ?? existing).branding ?? {};
    const incomingLogo =
      typeof body.branding.logoUrl === "string" ? body.branding.logoUrl : undefined;
    if (incomingLogo !== undefined) {
      // Allow only data: image URLs or empty string (clear).
      if (incomingLogo && !/^data:image\/(svg\+xml|png|jpeg);base64,/.test(incomingLogo)) {
        return NextResponse.json(
          { ok: false, error: "Logo must be a base64-encoded SVG, PNG, or JPEG data URL." },
          { status: 400 },
        );
      }
      if (incomingLogo.length > MAX_LOGO_BYTES) {
        return NextResponse.json(
          { ok: false, error: "Logo is too large (max ~1 MB)." },
          { status: 413 },
        );
      }
    }
    const incomingPrimary =
      typeof body.branding.primaryColor === "string" ? body.branding.primaryColor.trim() : undefined;
    const incomingSecondary =
      typeof body.branding.secondaryColor === "string" ? body.branding.secondaryColor.trim() : undefined;
    if (incomingPrimary !== undefined && incomingPrimary && !HEX_RE.test(incomingPrimary)) {
      return NextResponse.json({ ok: false, error: "Primary color must be a #rrggbb hex." }, { status: 400 });
    }
    if (incomingSecondary !== undefined && incomingSecondary && !HEX_RE.test(incomingSecondary)) {
      return NextResponse.json({ ok: false, error: "Secondary color must be a #rrggbb hex." }, { status: 400 });
    }
    const nextBranding: TenantSettingsBranding = {
      logoUrl: incomingLogo !== undefined ? incomingLogo : existingBranding.logoUrl,
      primaryColor: incomingPrimary !== undefined ? incomingPrimary : existingBranding.primaryColor,
      secondaryColor:
        incomingSecondary !== undefined ? incomingSecondary : existingBranding.secondaryColor,
    };
    nextSettings = { ...(nextSettings ?? existing), branding: nextBranding };
  }
  if (nextSettings) {
    data.settings = nextSettings as Prisma.InputJsonValue;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  }

  await prisma.organization.update({ where: { id: g.org!.id }, data });
  const fresh = await loadOrgWithCounts(g.org!.slug);
  if (!fresh) return NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    tenant: shapeTenant(fresh),
    counts: deriveCounts(fresh),
  });
}
