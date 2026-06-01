import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma, RoleKind, TenantStatus, TenantTier, TenantType } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface PatchBody {
  name?: string;
  tier?: string;
  region?: string;
  status?: string;
  multiAz?: boolean;
  s3Replication?: boolean;
}

const ALLOWED_TIERS_UI = ["Basic", "Pro", "Enterprise"] as const;
const ALLOWED_STATUSES: TenantStatus[] = ["active", "trial", "suspended", "archived"];
const ALLOWED_REGIONS = new Set([
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "eu-west-1",
  "eu-central-1",
  "us-east-1",
  "us-west-2",
]);

type UiTier = (typeof ALLOWED_TIERS_UI)[number];
const TIER_MAP: Record<UiTier, TenantTier> = {
  Basic: TenantTier.basic,
  Pro: TenantTier.pro,
  Enterprise: TenantTier.enterprise,
};
const REVERSE_TYPE: Record<TenantType, "Clinic" | "Hospital" | "Telemedicine" | "Diagnostic"> = {
  clinic: "Clinic",
  hospital: "Hospital",
  telemedicine: "Telemedicine",
  diagnostic: "Diagnostic",
};
const REVERSE_TIER: Record<TenantTier, UiTier> = {
  basic: "Basic",
  pro: "Pro",
  enterprise: "Enterprise",
};

async function requireSuperAdmin() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims || claims.role !== "Super Admin") {
    return NextResponse.json({ ok: false, error: "Forbidden — Super Admin only." }, { status: 403 });
  }
  return null;
}

async function loadBySlug(slug: string) {
  return prisma.organization.findUnique({
    where: { slug },
    include: {
      users: {
        where: { roleKind: RoleKind.org_admin },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { email: true, firstName: true, lastName: true },
      },
      _count: { select: { users: true } },
    },
  });
}

function shape(o: NonNullable<Awaited<ReturnType<typeof loadBySlug>>>) {
  const admin = o.users[0];
  return {
    id: o.slug,
    name: o.name,
    type: REVERSE_TYPE[o.type],
    tier: REVERSE_TIER[o.tier],
    region: o.region,
    status: o.status,
    multiAz: o.multiAzEnabled,
    s3Replication: o.crossRegionS3,
    adminEmail: admin?.email ?? null,
    adminName: admin ? `${admin.firstName} ${admin.lastName}`.trim() : null,
    usersCount: o._count.users,
    createdAt: o.createdAt.toISOString(),
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const org = await loadBySlug(id);
  if (!org || org.archivedAt) {
    return NextResponse.json({ ok: false, error: "Tenant not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, tenant: shape(org) });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const data: Prisma.OrganizationUpdateInput = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (name.length < 2) return NextResponse.json({ ok: false, error: "Tenant name must be at least 2 characters." }, { status: 400 });
    data.name = name;
  }
  if (body.tier !== undefined) {
    if (!ALLOWED_TIERS_UI.includes(body.tier as UiTier)) {
      return NextResponse.json({ ok: false, error: `Tier must be one of: ${ALLOWED_TIERS_UI.join(", ")}` }, { status: 400 });
    }
    data.tier = TIER_MAP[body.tier as UiTier];
  }
  if (body.region !== undefined) {
    if (!ALLOWED_REGIONS.has(body.region)) {
      return NextResponse.json({ ok: false, error: "Region not supported." }, { status: 400 });
    }
    data.region = body.region;
  }
  if (body.status !== undefined) {
    if (!ALLOWED_STATUSES.includes(body.status as TenantStatus)) {
      return NextResponse.json({ ok: false, error: `Status must be one of: ${ALLOWED_STATUSES.join(", ")}` }, { status: 400 });
    }
    data.status = body.status as TenantStatus;
  }
  if (body.multiAz !== undefined) data.multiAzEnabled = body.multiAz;
  if (body.s3Replication !== undefined) data.crossRegionS3 = body.s3Replication;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "No fields to update." }, { status: 400 });
  }

  try {
    const org = await prisma.organization.update({
      where: { slug: id },
      data,
      include: {
        users: {
          where: { roleKind: RoleKind.org_admin },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { email: true, firstName: true, lastName: true },
        },
        _count: { select: { users: true } },
      },
    });
    return NextResponse.json({ ok: true, tenant: shape(org) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ ok: false, error: "Tenant not found." }, { status: 404 });
    }
    throw err;
  }
}

/** Soft-delete (archive) — keeps the audit trail rather than dropping rows. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  try {
    await prisma.organization.update({
      where: { slug: id },
      data: { archivedAt: new Date(), status: TenantStatus.archived },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ ok: false, error: "Tenant not found." }, { status: 404 });
    }
    throw err;
  }
}
