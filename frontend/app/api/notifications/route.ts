import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** Shape matches `components/shared/notifications-list.tsx › SimpleNotification`. */
interface Notification {
  id: string;
  category:
    | "appointment"
    | "consent"
    | "message"
    | "record"
    | "security"
    | "audit"
    | "system"
    | "approval";
  title: string;
  body: string;
  time: string;
  href?: string;
  read?: boolean;
  critical?: boolean;
}

const SCOPE_LABEL: Record<string, string> = {
  insurance: "Insurance",
  id_proof: "ID Proof",
  lab: "Lab Report",
  imaging: "Imaging",
  prescriptions: "Prescriptions",
  notes: "Clinical Notes",
  mental_health: "Mental Health",
  other: "Other",
};

function relativeTime(iso: Date | string): string {
  const t = typeof iso === "string" ? Date.parse(iso) : iso.getTime();
  const min = Math.round((Date.now() - t) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtScopes(raw: Prisma.JsonValue): string {
  if (!Array.isArray(raw)) return "selected categories";
  const labels = raw.filter((s): s is string => typeof s === "string").map((s) => SCOPE_LABEL[s] ?? s);
  if (labels.length === 0) return "selected categories";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  return `${labels[0]} +${labels.length - 1} more`;
}

async function patientFeed(uid: string): Promise<Notification[]> {
  const out: Notification[] = [];

  // Pending + recent consent requests this patient has received.
  const reqs = await prisma.$queryRaw<
    {
      id: string;
      status: string;
      scopes: Prisma.JsonValue;
      requestedAt: Date;
      decidedAt: Date | null;
      clinicianFirstName: string;
      clinicianLastName: string;
    }[]
  >`
    SELECT cr.id, cr.status, cr.scopes, cr."requestedAt", cr."decidedAt",
           u."firstName" AS "clinicianFirstName",
           u."lastName"  AS "clinicianLastName"
    FROM consent_requests cr
    JOIN users u ON u.id = cr."clinicianId"
    WHERE cr."patientId" = ${uid}::uuid
    ORDER BY cr."requestedAt" DESC
    LIMIT 20
  `;
  for (const r of reqs) {
    const doctor = `Dr. ${r.clinicianFirstName} ${r.clinicianLastName}`.trim();
    if (r.status === "pending") {
      out.push({
        id: `cr-${r.id}`,
        category: "consent",
        title: `${doctor} requested access`,
        body: `Pending your review · ${fmtScopes(r.scopes)}`,
        time: relativeTime(r.requestedAt),
        href: "/patient/consents",
        critical: true,
      });
    } else if (r.status === "approved" && r.decidedAt) {
      out.push({
        id: `cr-${r.id}`,
        category: "consent",
        title: `You approved ${doctor}'s request`,
        body: fmtScopes(r.scopes),
        time: relativeTime(r.decidedAt),
        href: "/patient/consents",
        read: true,
      });
    } else if (r.status === "declined" && r.decidedAt) {
      out.push({
        id: `cr-${r.id}`,
        category: "consent",
        title: `You declined ${doctor}'s request`,
        body: fmtScopes(r.scopes),
        time: relativeTime(r.decidedAt),
        href: "/patient/consents",
        read: true,
      });
    }
  }

  // Upcoming appointments for this patient (next 14d).
  const now = new Date();
  const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 15);
  const appts = await prisma.$queryRaw<
    { id: string; startsAt: Date; status: string; clinicianFirstName: string; clinicianLastName: string }[]
  >`
    SELECT a.id, a."startsAt", a.status::text AS status,
           c."firstName" AS "clinicianFirstName",
           c."lastName"  AS "clinicianLastName"
    FROM appointments a
    JOIN users me ON me.id = ${uid}::uuid
    JOIN users c  ON c.id  = a."clinicianId"
    WHERE a."deletedAt" IS NULL
      AND a."patientEmail" = me.email
      AND a."startsAt" >= ${now}
      AND a."startsAt" <  ${horizon}
      AND a.status::text NOT IN ('cancelled','no_show','rejected')
    ORDER BY a."startsAt" ASC
    LIMIT 10
  `;
  for (const a of appts) {
    const doctor = `Dr. ${a.clinicianFirstName} ${a.clinicianLastName}`.trim();
    const when = a.startsAt.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    let title: string;
    let body = when;
    if (a.status === "requested") {
      title = `Appointment requested with ${doctor}`;
      body = `Awaiting confirmation · ${when}`;
    } else if (a.status === "reschedule_requested") {
      title = `${doctor} proposed a new time`;
      body = `Review & accept on your appointments page · ${when}`;
    } else if (a.status === "confirmed") {
      title = `Appointment confirmed with ${doctor}`;
    } else {
      title = `Upcoming appointment with ${doctor}`;
    }
    out.push({
      id: `ap-${a.id}`,
      category: "appointment",
      title,
      body,
      time: relativeTime(a.startsAt),
      href: "/patient/appointments",
    });
  }

  // Recently rejected appointment requests (last 14d) — the clinician declined.
  const rejectedSince = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
  const rejected = await prisma.$queryRaw<
    { id: string; startsAt: Date; updatedAt: Date; clinicianFirstName: string; clinicianLastName: string }[]
  >`
    SELECT a.id, a."startsAt", a."updatedAt",
           c."firstName" AS "clinicianFirstName",
           c."lastName"  AS "clinicianLastName"
    FROM appointments a
    JOIN users me ON me.id = ${uid}::uuid
    JOIN users c  ON c.id  = a."clinicianId"
    WHERE a."deletedAt" IS NULL
      AND a."patientEmail" = me.email
      AND a.status::text = 'rejected'
      AND a."updatedAt" >= ${rejectedSince}
    ORDER BY a."updatedAt" DESC
    LIMIT 10
  `;
  for (const a of rejected) {
    const doctor = `Dr. ${a.clinicianFirstName} ${a.clinicianLastName}`.trim();
    out.push({
      id: `ap-rej-${a.id}`,
      category: "appointment",
      title: `Appointment declined by ${doctor}`,
      body: "Your requested slot wasn't available — please book another time.",
      time: relativeTime(a.updatedAt),
      href: "/patient/appointments",
    });
  }

  // Appointment reminders dispatched in the last 24h (T-24h / T-1h).
  const reminders = await prisma.$queryRaw<
    { kind: string; sentAt: Date; startsAt: Date; clinicianFirstName: string; clinicianLastName: string; appointmentId: string }[]
  >`
    SELECT r.kind, r."sentAt", a."startsAt", a.id AS "appointmentId",
           c."firstName" AS "clinicianFirstName",
           c."lastName"  AS "clinicianLastName"
    FROM appointment_reminders r
    JOIN appointments a ON a.id = r."appointmentId"
    JOIN users me ON me.id = ${uid}::uuid
    JOIN users c  ON c.id  = a."clinicianId"
    WHERE r."sentAt" IS NOT NULL
      AND r."sentAt" >= ${new Date(now.getTime() - 24 * 60 * 60 * 1000)}
      AND a."patientEmail" = me.email
      AND a."deletedAt" IS NULL
    ORDER BY r."sentAt" DESC
    LIMIT 10
  `;
  for (const r of reminders) {
    const doctor = `Dr. ${r.clinicianFirstName} ${r.clinicianLastName}`.trim();
    const lead = r.kind === "t_24h" ? "in 24 hours" : r.kind === "t_1h" ? "in 1 hour" : "soon";
    const when = r.startsAt.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    out.push({
      id: `ap-rem-${r.appointmentId}-${r.kind}`,
      category: "appointment",
      title: `Reminder: appointment ${lead}`,
      body: `${doctor} · ${when}`,
      time: relativeTime(r.sentAt),
      href: "/patient/appointments",
    });
  }

  // Recently finalized prescriptions (last 14d).
  const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
  const rx = await prisma.$queryRaw<
    { id: string; drugName: string; createdAt: Date; clinicianFirstName: string; clinicianLastName: string }[]
  >`
    SELECT p.id, p."drugName", p."createdAt",
           c."firstName" AS "clinicianFirstName",
           c."lastName"  AS "clinicianLastName"
    FROM prescriptions p
    JOIN users c ON c.id = p."clinicianId"
    WHERE p."patientId" = ${uid}::uuid
      AND p.status = 'finalized'
      AND p."createdAt" >= ${past}
    ORDER BY p."createdAt" DESC
    LIMIT 10
  `;
  for (const p of rx) {
    out.push({
      id: `rx-${p.id}`,
      category: "record",
      title: `New prescription: ${p.drugName}`,
      body: `From Dr. ${p.clinicianFirstName} ${p.clinicianLastName}`.trim(),
      time: relativeTime(p.createdAt),
      href: "/patient/prescriptions",
    });
  }

  return out;
}

async function clinicianFeed(uid: string): Promise<Notification[]> {
  const out: Notification[] = [];
  const now = new Date();
  const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);

  // Decided consent requests where I'm the requesting clinician (last 14d).
  const decided = await prisma.$queryRaw<
    {
      id: string;
      status: string;
      scopes: Prisma.JsonValue;
      decidedAt: Date | null;
      patientFirstName: string;
      patientLastName: string;
      patientId: string;
    }[]
  >`
    SELECT cr.id, cr.status, cr.scopes, cr."decidedAt",
           u."firstName" AS "patientFirstName",
           u."lastName"  AS "patientLastName",
           cr."patientId"
    FROM consent_requests cr
    JOIN users u ON u.id = cr."patientId"
    WHERE cr."clinicianId" = ${uid}::uuid
      AND cr."decidedAt" IS NOT NULL
      AND cr."decidedAt" >= ${past}
    ORDER BY cr."decidedAt" DESC
    LIMIT 20
  `;
  for (const r of decided) {
    const patient = `${r.patientFirstName} ${r.patientLastName}`.trim();
    const verb = r.status === "approved" ? "approved" : "declined";
    out.push({
      id: `cr-${r.id}`,
      category: "consent",
      title: `${patient} ${verb} your request`,
      body: fmtScopes(r.scopes),
      time: relativeTime(r.decidedAt!),
      href: `/clinician/patients/${r.patientId}`,
    });
  }

  // New appointments booked with me in the last 14 days, looking forward.
  const appts = await prisma.$queryRaw<
    { id: string; startsAt: Date; createdAt: Date; patientName: string }[]
  >`
    SELECT id, "startsAt", "createdAt", "patientName"
    FROM appointments
    WHERE "clinicianId" = ${uid}::uuid
      AND "deletedAt" IS NULL
      AND "createdAt" >= ${past}
      AND status::text NOT IN ('cancelled','no_show')
    ORDER BY "createdAt" DESC
    LIMIT 15
  `;
  for (const a of appts) {
    out.push({
      id: `ap-${a.id}`,
      category: "appointment",
      title: `${a.patientName} booked an appointment`,
      body: a.startsAt.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      time: relativeTime(a.createdAt),
      href: "/clinician/schedule",
    });
  }

  // Newly assigned patients (last 14d).
  const assigns = await prisma.$queryRaw<
    { startedAt: Date; firstName: string; lastName: string; id: string }[]
  >`
    SELECT pa."startedAt", u."firstName", u."lastName", u.id
    FROM patient_assignments pa
    JOIN users u ON u.id = pa."patientId"
    WHERE pa."clinicianId" = ${uid}::uuid
      AND pa."endedAt" IS NULL
      AND pa."startedAt" >= ${past}
    ORDER BY pa."startedAt" DESC
    LIMIT 10
  `;
  for (const a of assigns) {
    const patient = `${a.firstName} ${a.lastName}`.trim();
    out.push({
      id: `pa-${a.id}-${a.startedAt.getTime()}`,
      category: "record",
      title: `New patient assigned: ${patient}`,
      body: "Open the chart to review their history and consents",
      time: relativeTime(a.startedAt),
      href: `/clinician/patients/${a.id}`,
    });
  }

  return out;
}

async function adminFeed(uid: string): Promise<Notification[]> {
  const out: Notification[] = [];
  const now = new Date();
  const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);

  // Resolve my organizationId first.
  const meRows = await prisma.$queryRaw<{ organizationId: string | null }[]>`
    SELECT "organizationId" FROM users WHERE id = ${uid}::uuid LIMIT 1
  `;
  const orgId = meRows[0]?.organizationId;
  if (!orgId) return out;

  // New users in my tenant (patients + staff) in last 14d.
  const users = await prisma.$queryRaw<
    { id: string; firstName: string; lastName: string; roleKind: string; createdAt: Date }[]
  >`
    SELECT id, "firstName", "lastName", "roleKind"::text AS "roleKind", "createdAt"
    FROM users
    WHERE "organizationId" = ${orgId}::uuid
      AND "deletedAt" IS NULL
      AND "createdAt" >= ${past}
      AND id <> ${uid}::uuid
    ORDER BY "createdAt" DESC
    LIMIT 20
  `;
  for (const u of users) {
    const name = `${u.firstName} ${u.lastName}`.trim();
    const isPatient = u.roleKind === "patient";
    out.push({
      id: `usr-${u.id}`,
      category: "record",
      title: isPatient ? `New patient: ${name}` : `New staff joined: ${name}`,
      body: isPatient ? "Assign a clinician from the patient detail page" : `Role: ${u.roleKind}`,
      time: relativeTime(u.createdAt),
      href: isPatient ? `/admin/patients/${u.id}` : `/admin/users`,
    });
  }

  // New patient assignments in the tenant.
  const assigns = await prisma.$queryRaw<
    {
      startedAt: Date;
      patientFirstName: string;
      patientLastName: string;
      clinicianFirstName: string;
      clinicianLastName: string;
      patientId: string;
    }[]
  >`
    SELECT pa."startedAt",
           p."firstName" AS "patientFirstName",  p."lastName" AS "patientLastName",
           c."firstName" AS "clinicianFirstName", c."lastName" AS "clinicianLastName",
           pa."patientId"
    FROM patient_assignments pa
    JOIN users p ON p.id = pa."patientId"
    JOIN users c ON c.id = pa."clinicianId"
    WHERE p."organizationId" = ${orgId}::uuid
      AND pa."endedAt" IS NULL
      AND pa."startedAt" >= ${past}
    ORDER BY pa."startedAt" DESC
    LIMIT 15
  `;
  for (const a of assigns) {
    const patient = `${a.patientFirstName} ${a.patientLastName}`.trim();
    const doctor = `Dr. ${a.clinicianFirstName} ${a.clinicianLastName}`.trim();
    out.push({
      id: `pa-${a.patientId}-${a.startedAt.getTime()}`,
      category: "system",
      title: `${patient} assigned to ${doctor}`,
      body: "Open the patient profile to review the care team",
      time: relativeTime(a.startedAt),
      href: `/admin/patients/${a.patientId}`,
    });
  }

  return out;
}

async function complianceFeed(uid: string): Promise<Notification[]> {
  const out: Notification[] = [];
  const now = new Date();
  const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);

  const meRows = await prisma.$queryRaw<{ organizationId: string | null }[]>`
    SELECT "organizationId" FROM users WHERE id = ${uid}::uuid LIMIT 1
  `;
  const orgId = meRows[0]?.organizationId;
  if (!orgId) return out;

  // Pending consent requests in tenant (anything not yet decided).
  const pending = await prisma.$queryRaw<
    {
      id: string;
      scopes: Prisma.JsonValue;
      requestedAt: Date;
      patientFirstName: string;
      patientLastName: string;
      clinicianFirstName: string;
      clinicianLastName: string;
    }[]
  >`
    SELECT cr.id, cr.scopes, cr."requestedAt",
           p."firstName" AS "patientFirstName",  p."lastName" AS "patientLastName",
           c."firstName" AS "clinicianFirstName", c."lastName" AS "clinicianLastName"
    FROM consent_requests cr
    JOIN users p ON p.id = cr."patientId"
    JOIN users c ON c.id = cr."clinicianId"
    WHERE cr."organizationId" = ${orgId}::uuid
      AND cr.status = 'pending'
    ORDER BY cr."requestedAt" DESC
    LIMIT 20
  `;
  for (const r of pending) {
    const patient = `${r.patientFirstName} ${r.patientLastName}`.trim();
    const doctor = `Dr. ${r.clinicianFirstName} ${r.clinicianLastName}`.trim();
    out.push({
      id: `cr-${r.id}`,
      category: "approval",
      title: `Awaiting decision: ${doctor} → ${patient}`,
      body: fmtScopes(r.scopes),
      time: relativeTime(r.requestedAt),
      href: "/compliance/approvals",
      critical: true,
    });
  }

  // Recent consent decisions (audit signal).
  const decided = await prisma.$queryRaw<
    {
      id: string;
      status: string;
      scopes: Prisma.JsonValue;
      decidedAt: Date;
      patientFirstName: string;
      patientLastName: string;
      clinicianFirstName: string;
      clinicianLastName: string;
    }[]
  >`
    SELECT cr.id, cr.status, cr.scopes, cr."decidedAt",
           p."firstName" AS "patientFirstName",  p."lastName" AS "patientLastName",
           c."firstName" AS "clinicianFirstName", c."lastName" AS "clinicianLastName"
    FROM consent_requests cr
    JOIN users p ON p.id = cr."patientId"
    JOIN users c ON c.id = cr."clinicianId"
    WHERE cr."organizationId" = ${orgId}::uuid
      AND cr.status IN ('approved','declined')
      AND cr."decidedAt" >= ${past}
    ORDER BY cr."decidedAt" DESC
    LIMIT 20
  `;
  for (const r of decided) {
    const patient = `${r.patientFirstName} ${r.patientLastName}`.trim();
    const doctor = `Dr. ${r.clinicianFirstName} ${r.clinicianLastName}`.trim();
    out.push({
      id: `crd-${r.id}`,
      category: "consent",
      title: `${patient} ${r.status} request from ${doctor}`,
      body: fmtScopes(r.scopes),
      time: relativeTime(r.decidedAt),
      href: "/compliance/consents",
    });
  }

  return out;
}

async function auditorFeed(uid: string): Promise<Notification[]> {
  const out: Notification[] = [];
  const now = new Date();
  const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);

  const meRows = await prisma.$queryRaw<{ organizationId: string | null }[]>`
    SELECT "organizationId" FROM users WHERE id = ${uid}::uuid LIMIT 1
  `;
  const orgId = meRows[0]?.organizationId;
  if (!orgId) return out;

  // Consent decisions feed.
  const decided = await prisma.$queryRaw<
    {
      id: string;
      status: string;
      scopes: Prisma.JsonValue;
      decidedAt: Date;
      patientFirstName: string;
      patientLastName: string;
      clinicianFirstName: string;
      clinicianLastName: string;
    }[]
  >`
    SELECT cr.id, cr.status, cr.scopes, cr."decidedAt",
           p."firstName" AS "patientFirstName",  p."lastName" AS "patientLastName",
           c."firstName" AS "clinicianFirstName", c."lastName" AS "clinicianLastName"
    FROM consent_requests cr
    JOIN users p ON p.id = cr."patientId"
    JOIN users c ON c.id = cr."clinicianId"
    WHERE cr."organizationId" = ${orgId}::uuid
      AND cr."decidedAt" IS NOT NULL
      AND cr."decidedAt" >= ${past}
    ORDER BY cr."decidedAt" DESC
    LIMIT 25
  `;
  for (const r of decided) {
    const patient = `${r.patientFirstName} ${r.patientLastName}`.trim();
    const doctor = `Dr. ${r.clinicianFirstName} ${r.clinicianLastName}`.trim();
    out.push({
      id: `aud-cr-${r.id}`,
      category: "audit",
      title: `Consent ${r.status}: ${patient} → ${doctor}`,
      body: fmtScopes(r.scopes),
      time: relativeTime(r.decidedAt),
      href: "/auditor/consents",
    });
  }

  // Recent appointments in tenant.
  const appts = await prisma.$queryRaw<
    { id: string; startsAt: Date; createdAt: Date; patientName: string; clinicianFirstName: string; clinicianLastName: string }[]
  >`
    SELECT a.id, a."startsAt", a."createdAt", a."patientName",
           c."firstName" AS "clinicianFirstName",
           c."lastName"  AS "clinicianLastName"
    FROM appointments a
    JOIN users c ON c.id = a."clinicianId"
    WHERE a."organizationId" = ${orgId}::uuid
      AND a."deletedAt" IS NULL
      AND a."createdAt" >= ${past}
    ORDER BY a."createdAt" DESC
    LIMIT 15
  `;
  for (const a of appts) {
    out.push({
      id: `aud-ap-${a.id}`,
      category: "audit",
      title: `Appointment booked: ${a.patientName} with Dr. ${a.clinicianFirstName} ${a.clinicianLastName}`.trim(),
      body: a.startsAt.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      time: relativeTime(a.createdAt),
      href: "/auditor/logs",
    });
  }

  return out;
}

async function superFeed(): Promise<Notification[]> {
  const out: Notification[] = [];
  const now = new Date();
  const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);

  // Recent tenants.
  const tenants = await prisma.$queryRaw<{ id: string; name: string; createdAt: Date }[]>`
    SELECT id, name, "createdAt"
    FROM organizations
    WHERE "createdAt" >= ${past}
    ORDER BY "createdAt" DESC
    LIMIT 15
  `;
  for (const t of tenants) {
    out.push({
      id: `tn-${t.id}`,
      category: "system",
      title: `New tenant provisioned: ${t.name}`,
      body: "Configure billing tier and onboarding link from the tenant detail page",
      time: relativeTime(t.createdAt),
      href: `/super/tenants/${t.id}`,
    });
  }

  // Recent org-admin signups (across all tenants).
  const admins = await prisma.$queryRaw<
    { id: string; firstName: string; lastName: string; createdAt: Date; orgName: string | null }[]
  >`
    SELECT u.id, u."firstName", u."lastName", u."createdAt", o.name AS "orgName"
    FROM users u
    LEFT JOIN organizations o ON o.id = u."organizationId"
    WHERE u."deletedAt" IS NULL
      AND u."roleKind"::text = 'org_admin'
      AND u."createdAt" >= ${past}
    ORDER BY u."createdAt" DESC
    LIMIT 15
  `;
  for (const a of admins) {
    const name = `${a.firstName} ${a.lastName}`.trim();
    out.push({
      id: `oa-${a.id}`,
      category: "audit",
      title: `Org admin onboarded: ${name}`,
      body: a.orgName ?? "Unassigned tenant",
      time: relativeTime(a.createdAt),
      href: "/super/tenants",
    });
  }

  return out;
}

export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  // Demo-user session (non-UUID uid) → no DB rows; return empty feed so the
  // page renders with the "You're all caught up" empty state.
  if (!isDbUid(claims.uid)) return NextResponse.json({ ok: true, items: [] });

  try {
    let items: Notification[] = [];
    switch (claims.role) {
      case "Patient":            items = await patientFeed(claims.uid); break;
      case "Clinician":          items = await clinicianFeed(claims.uid); break;
      case "Org Admin":          items = await adminFeed(claims.uid); break;
      case "Compliance Manager": items = await complianceFeed(claims.uid); break;
      case "Auditor":            items = await auditorFeed(claims.uid); break;
      case "Super Admin":        items = await superFeed(); break;
      default: items = [];
    }
    // Most recent first.
    items.sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0));
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("[api/notifications] failed:", err);
    return NextResponse.json({ ok: true, items: [] });
  }
}
