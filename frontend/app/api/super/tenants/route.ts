import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { Prisma, RoleKind, TenantStatus, TenantTier, TenantType, UserStatus } from "@prisma/client";
import { SESSION_COOKIE, signOnboardToken, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mailerConfigured, sendMail, transportsFromIntegrations, welcomeEmail } from "@/lib/mail";
import { newJti, stashOnboardCred } from "@/lib/password-store";

export const runtime = "nodejs";

const ALLOWED_TYPES_UI = ["Clinic", "Hospital", "Telemedicine", "Diagnostic"] as const;
const ALLOWED_TIERS_UI = ["Basic", "Pro", "Enterprise"] as const;
const ALLOWED_REGIONS = new Set([
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "eu-west-1",
  "eu-central-1",
  "us-east-1",
  "us-west-2",
]);

type UiType = (typeof ALLOWED_TYPES_UI)[number];
type UiTier = (typeof ALLOWED_TIERS_UI)[number];

const TYPE_MAP: Record<UiType, TenantType> = {
  Clinic: TenantType.clinic,
  Hospital: TenantType.hospital,
  Telemedicine: TenantType.telemedicine,
  Diagnostic: TenantType.diagnostic,
};
const TIER_MAP: Record<UiTier, TenantTier> = {
  Basic: TenantTier.basic,
  Pro: TenantTier.pro,
  Enterprise: TenantTier.enterprise,
};

const REVERSE_TYPE: Record<TenantType, UiType> = {
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

interface IntegrationFlags {
  sendgrid?: boolean;
  twilioSms?: boolean;
  clamav?: boolean;
  customSmtp?: boolean;
}

interface CreateTenantBody {
  name?: string;
  id?: string;
  type?: string;
  tier?: string;
  region?: string;
  multiAz?: boolean;
  s3Replication?: boolean;
  contact?: { email?: string; phone?: string; address?: string };
  adminName?: string;
  adminEmail?: string;
  integrations?: IntegrationFlags;
}

async function requireSuperAdmin() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims || claims.role !== "Super Admin") {
    return NextResponse.json({ ok: false, error: "Forbidden — Super Admin only." }, { status: 403 });
  }
  return null;
}

function slugifyTenantId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 36);
  // Slug must start with a lowercase letter per the schema regex used elsewhere.
  const safe = /^[a-z]/.test(slug) ? slug : `org_${slug}`;
  return safe.startsWith("org_") ? safe : `org_${safe}`;
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

interface PublicTenant {
  id: string;
  name: string;
  type: UiType;
  tier: UiTier;
  region: string;
  status: TenantStatus;
  multiAz: boolean;
  s3Replication: boolean;
  adminEmail: string | null;
  adminName: string | null;
  usersCount: number;
  createdAt: string;
}

async function shapeTenants(): Promise<PublicTenant[]> {
  const rows = await prisma.organization.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
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
  return rows.map((o) => {
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
  });
}

export async function GET() {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  return NextResponse.json({ ok: true, tenants: await shapeTenants() });
}

export async function POST(req: Request) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  let body: CreateTenantBody;
  try {
    body = (await req.json()) as CreateTenantBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const adminName = body.adminName?.trim() ?? "";
  const adminEmail = body.adminEmail?.trim().toLowerCase() ?? "";
  if (!name) return NextResponse.json({ ok: false, error: "Tenant name is required." }, { status: 400 });
  if (!adminName) return NextResponse.json({ ok: false, error: "Org Admin full name is required." }, { status: 400 });
  if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    return NextResponse.json({ ok: false, error: "A valid Org Admin email is required." }, { status: 400 });
  }

  const uiType = (body.type ?? "Clinic") as UiType;
  if (!ALLOWED_TYPES_UI.includes(uiType)) {
    return NextResponse.json({ ok: false, error: `Type must be one of: ${ALLOWED_TYPES_UI.join(", ")}` }, { status: 400 });
  }
  const uiTier = (body.tier ?? "Basic") as UiTier;
  if (!ALLOWED_TIERS_UI.includes(uiTier)) {
    return NextResponse.json({ ok: false, error: `Tier must be one of: ${ALLOWED_TIERS_UI.join(", ")}` }, { status: 400 });
  }
  const region = body.region?.trim() || "ap-south-1";
  if (!ALLOWED_REGIONS.has(region)) {
    return NextResponse.json({ ok: false, error: "Region not supported." }, { status: 400 });
  }

  const slug = body.id?.trim() || slugifyTenantId(name);

  // Up-front uniqueness check (Postgres unique constraints will also enforce).
  const [slugTaken, emailTaken] = await Promise.all([
    prisma.organization.findUnique({ where: { slug }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } }),
  ]);
  if (slugTaken) {
    return NextResponse.json({ ok: false, error: `Tenant id "${slug}" already exists.` }, { status: 409 });
  }
  if (emailTaken) {
    return NextResponse.json(
      { ok: false, error: `The email "${adminEmail}" is already in use by another account. Use a different email.` },
      { status: 409 },
    );
  }

  const firstSpace = adminName.indexOf(" ");
  const firstName = firstSpace === -1 ? adminName : adminName.slice(0, firstSpace);
  const lastName = firstSpace === -1 ? "" : adminName.slice(firstSpace + 1).trim();

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  // Per-tenant integration toggles — saved to Organization.settings.integrations
  // and used immediately to pick the welcome-email transport.
  const integrations: IntegrationFlags = {
    sendgrid: !!body.integrations?.sendgrid,
    twilioSms: !!body.integrations?.twilioSms,
    clamav: !!body.integrations?.clamav,
    customSmtp: !!body.integrations?.customSmtp,
  };

  // Organization contact → settings.contact (read by /api/admin/tenant +
  // the Org Admin Settings → Profile tab). All optional.
  const contact = {
    email: typeof body.contact?.email === "string" ? body.contact.email.trim() : "",
    phone: typeof body.contact?.phone === "string" ? body.contact.phone.trim() : "",
    address: typeof body.contact?.address === "string" ? body.contact.address.trim() : "",
  };

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          slug,
          name,
          type: TYPE_MAP[uiType],
          tier: TIER_MAP[uiTier],
          region,
          multiAzEnabled: body.multiAz ?? true,
          crossRegionS3: body.s3Replication ?? false,
          settings: { integrations, contact } as Prisma.InputJsonValue,
        },
      });
      const role = await tx.role.create({
        data: {
          organizationId: org.id,
          kind: RoleKind.org_admin,
          name: "Org Admin",
          description: "Manages tenant-scoped users and configuration",
        },
      });
      const admin = await tx.user.create({
        data: {
          organizationId: org.id,
          email: adminEmail,
          passwordHash,
          firstName,
          lastName: lastName || "Admin",
          roleKind: RoleKind.org_admin,
          roleId: role.id,
          status: UserStatus.invited,
        },
      });
      return { org, admin };
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "A tenant with that slug or admin email already exists." },
        { status: 409 },
      );
    }
    throw err;
  }

  const onboardJti = newJti();
  stashOnboardCred(onboardJti, tempPassword);
  const onboardToken = await signOnboardToken({
    uid: created.admin.id,
    email: created.admin.email,
    jti: onboardJti,
  });
  const origin = new URL(req.url).origin;
  const loginUrl = `${origin}/staff-login?onboard=${encodeURIComponent(onboardToken)}`;

  // Welcome-email transport order is driven by the per-tenant integration
  // toggles: SendGrid / Twilio SMS / Custom SMTP get prepended (in that
  // priority), then `sendMail` falls back through Resend → SMTP as usual.
  const prefer = transportsFromIntegrations(integrations);

  let mailSent = false;
  let mailVia: string | undefined;
  let mailError: string | undefined;
  let mailAttempts: { via: string; outcome: string; error?: string }[] = [];
  if (mailerConfigured() || prefer.length > 0) {
    const { subject, text, html } = welcomeEmail({
      name: adminName,
      tenantName: name,
      email: adminEmail,
      password: tempPassword,
      loginUrl,
    });
    const result = await sendMail({
      to: adminEmail,
      subject,
      text,
      html,
      prefer,
    });
    mailSent = result.ok;
    mailVia = result.via;
    mailAttempts = result.attempts ?? [];
    if (!result.ok) {
      mailError = result.error;
      console.error(
        `[super/tenants] welcome mail failed (last attempt via ${result.via}): ${result.error}`,
      );
    } else {
      console.log(`[super/tenants] welcome mail sent via ${result.via} to ${adminEmail}`);
    }
  } else {
    console.warn(
      "[super/tenants] no mail transport configured — surfacing temp password in API response as dev fallback",
    );
  }

  const publicTenant: PublicTenant = {
    id: created.org.slug,
    name: created.org.name,
    type: REVERSE_TYPE[created.org.type],
    tier: REVERSE_TIER[created.org.tier],
    region: created.org.region,
    status: created.org.status,
    multiAz: created.org.multiAzEnabled,
    s3Replication: created.org.crossRegionS3,
    adminEmail: created.admin.email,
    adminName: `${created.admin.firstName} ${created.admin.lastName}`.trim(),
    usersCount: 1,
    createdAt: created.org.createdAt.toISOString(),
  };

  return NextResponse.json(
    {
      ok: true,
      tenant: publicTenant,
      mailSent,
      mailVia,
      mailAttempts,
      ...(mailSent
        ? {}
        : { mailError, devCredentials: { email: adminEmail, password: tempPassword, loginUrl } }),
    },
    { status: 201 },
  );
}
