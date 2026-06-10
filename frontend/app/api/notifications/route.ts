import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prefChannelOn } from "@/lib/notify";

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
    | "approval"
    | "tenants"
    | "task";
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

  // Date windows used across the queries (hoisted so all queries can run in parallel).
  const now = new Date();
  const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 15);
  const rejectedSince = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
  const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);

  // All feeds are independent → fire them in one parallel batch so the
  // total wall-clock is ~1 DB round-trip (big win on a remote DB).
  const [reqs, appts, rejected, reminders, rx, dataReqs, notes, docs, msgs, expiring] = await Promise.all([
    prisma.$queryRaw<
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
    `,
    prisma.$queryRaw<
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
    `,
    prisma.$queryRaw<
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
    `,
    prisma.$queryRaw<
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
    `,
    prisma.$queryRaw<
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
    `,
    // Outcome of the patient's own data (deletion/export) requests.
    prisma.$queryRaw<
      { id: string; type: string; status: string; decisionNote: string | null; decidedAt: Date | null }[]
    >`
      SELECT id, type, status, "decisionNote", "decidedAt"
      FROM data_requests
      WHERE "patientId" = ${uid}::uuid
        AND status IN ('approved_partial','approved_full','rejected')
        AND "decidedAt" >= ${past}
      ORDER BY "decidedAt" DESC
      LIMIT 10
    `,
    // Finalized clinical notes (Records) authored for this patient.
    prisma.$queryRaw<
      { id: string; template: string; finalizedAt: Date; clinicianFirstName: string | null; clinicianLastName: string | null }[]
    >`
      SELECT m.id, m.template, m."finalizedAt",
             c."firstName" AS "clinicianFirstName", c."lastName" AS "clinicianLastName"
      FROM medical_records m
      LEFT JOIN users c ON c.id = m."clinicianId"
      WHERE m."patientId" = ${uid}::uuid
        AND m.status = 'finalized'
        AND m."deletedAt" IS NULL
        AND m."finalizedAt" >= ${past}
      ORDER BY m."finalizedAt" DESC
      LIMIT 10
    `,
    // Documents the care team shared with this patient.
    prisma.$queryRaw<
      { id: string; name: string; category: string; uploadedAt: Date }[]
    >`
      SELECT d.id, d.name, d.category, d."uploadedAt"
      FROM patient_documents d
      WHERE d."patientId" = ${uid}::uuid
        AND d."sharedWithPatient" = true
        AND d."uploadedById" <> ${uid}::uuid
        AND d."deletedAt" IS NULL
        AND d."uploadedAt" >= ${past}
      ORDER BY d."uploadedAt" DESC
      LIMIT 10
    `,
    // Incoming secure messages from the care team (clinician → patient).
    prisma.$queryRaw<
      { id: string; body: string; sentAt: Date; readAt: Date | null; clinicianFirstName: string | null; clinicianLastName: string | null }[]
    >`
      SELECT m.id, m.body, m."sentAt", m."readAt",
             c."firstName" AS "clinicianFirstName", c."lastName" AS "clinicianLastName"
      FROM messages m
      LEFT JOIN users c ON c.id = m."clinicianId"
      WHERE m."patientId" = ${uid}::uuid
        AND m."senderRole" = 'clinician'
        AND m."sentAt" >= ${past}
      ORDER BY m."sentAt" DESC
      LIMIT 10
    `,
    // Active consents expiring within 7 days.
    prisma.$queryRaw<
      { id: string; scopes: Prisma.JsonValue; expiresAt: Date; clinicianFirstName: string | null; clinicianLastName: string | null }[]
    >`
      SELECT cr.id, cr.scopes, cr."expiresAt",
             c."firstName" AS "clinicianFirstName", c."lastName" AS "clinicianLastName"
      FROM consent_requests cr
      LEFT JOIN users c ON c.id = cr."clinicianId"
      WHERE cr."patientId" = ${uid}::uuid
        AND cr.status = 'approved'
        AND cr."expiresAt" IS NOT NULL
        AND cr."expiresAt" > ${now}
        AND cr."expiresAt" <= ${new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)}
      ORDER BY cr."expiresAt" ASC
      LIMIT 10
    `,
  ]);

  for (const d of dataReqs) {
    const kindLabel = d.type === "export" ? "data export" : "data deletion";
    const title =
      d.status === "rejected"
        ? `Your ${kindLabel} request was declined`
        : `Your ${kindLabel} request was reviewed`;
    out.push({
      id: `dr-${d.id}`,
      category: "system",
      title,
      body: d.decisionNote ?? "Your Compliance Manager has reviewed your request.",
      time: relativeTime(d.decidedAt ?? new Date()),
      href: "/patient/settings",
      critical: true,
    });
  }

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

  // Finalized clinical notes (Records).
  for (const n of notes) {
    const doctor = `Dr. ${[n.clinicianFirstName, n.clinicianLastName].filter(Boolean).join(" ")}`.trim();
    out.push({
      id: `note-${n.id}`,
      category: "record",
      title: `New ${n.template} note`,
      body: `Finalized by ${doctor}`,
      time: relativeTime(n.finalizedAt),
      href: "/patient/records",
    });
  }

  // Documents shared by the care team.
  for (const d of docs) {
    out.push({
      id: `doc-${d.id}`,
      category: "record",
      title: `New document: ${d.name}`,
      body: `${d.category} · shared by your care team`,
      time: relativeTime(d.uploadedAt),
      href: "/patient/documents",
    });
  }

  // Incoming secure messages from the care team.
  for (const m of msgs) {
    const doctor = `Dr. ${[m.clinicianFirstName, m.clinicianLastName].filter(Boolean).join(" ")}`.trim();
    const snippet = (m.body ?? "").trim().slice(0, 80) || "Sent you an attachment";
    out.push({
      id: `msg-${m.id}`,
      category: "message",
      title: `New message from ${doctor}`,
      body: snippet,
      time: relativeTime(m.sentAt),
      href: "/patient/messages",
      read: !!m.readAt,
    });
  }

  // Consents expiring within 7 days.
  for (const e of expiring) {
    const doctor = `Dr. ${[e.clinicianFirstName, e.clinicianLastName].filter(Boolean).join(" ")}`.trim();
    out.push({
      id: `ce-${e.id}`,
      category: "consent",
      title: `Consent expiring soon`,
      body: `${fmtScopes(e.scopes)} for ${doctor} · expires ${e.expiresAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      time: relativeTime(e.expiresAt),
      href: "/patient/consents",
    });
  }

  return out;
}

async function clinicianFeed(uid: string): Promise<Notification[]> {
  const out: Notification[] = [];
  const now = new Date();
  const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);

  // All feeds are independent → fetch in parallel (one DB round-trip).
  const [decided, appts, assigns, msgs, cancelled, rescheduled, expiring, draftNotes] = await Promise.all([
    prisma.$queryRaw<
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
    `,
    prisma.$queryRaw<
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
    `,
    prisma.$queryRaw<
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
    `,
    // Incoming secure messages FROM patients (replies to the care team).
    prisma.$queryRaw<
      { id: string; body: string; sentAt: Date; readAt: Date | null; patientFirstName: string; patientLastName: string }[]
    >`
      SELECT m.id, m.body, m."sentAt", m."readAt",
             p."firstName" AS "patientFirstName", p."lastName" AS "patientLastName"
      FROM messages m
      JOIN users p ON p.id = m."patientId"
      WHERE m."clinicianId" = ${uid}::uuid
        AND m."senderRole" = 'patient'
        AND m."sentAt" >= ${past}
      ORDER BY m."sentAt" DESC
      LIMIT 10
    `,
    // Appointments the patient cancelled (last 14d).
    prisma.$queryRaw<{ id: string; startsAt: Date; updatedAt: Date; patientName: string | null }[]>`
      SELECT id, "startsAt", "updatedAt", "patientName"
      FROM appointments
      WHERE "clinicianId" = ${uid}::uuid
        AND "deletedAt" IS NULL
        AND status::text = 'cancelled'
        AND "updatedAt" >= ${past}
      ORDER BY "updatedAt" DESC
      LIMIT 10
    `,
    // Appointments the patient rescheduled (back to `requested` with a new
    // time — detected via updatedAt clearly after createdAt).
    prisma.$queryRaw<{ id: string; startsAt: Date; updatedAt: Date; patientName: string | null }[]>`
      SELECT id, "startsAt", "updatedAt", "patientName"
      FROM appointments
      WHERE "clinicianId" = ${uid}::uuid
        AND "deletedAt" IS NULL
        AND status::text = 'requested'
        AND "updatedAt" >= ${past}
        AND "updatedAt" > "createdAt" + interval '2 minutes'
      ORDER BY "updatedAt" DESC
      LIMIT 10
    `,
    // Consents the clinician holds that expire within 7 days.
    prisma.$queryRaw<
      { id: string; scopes: Prisma.JsonValue; expiresAt: Date; patientFirstName: string; patientLastName: string }[]
    >`
      SELECT cr.id, cr.scopes, cr."expiresAt",
             p."firstName" AS "patientFirstName", p."lastName" AS "patientLastName"
      FROM consent_requests cr
      JOIN users p ON p.id = cr."patientId"
      WHERE cr."clinicianId" = ${uid}::uuid
        AND cr.status = 'approved'
        AND cr."expiresAt" IS NOT NULL
        AND cr."expiresAt" > ${now}
        AND cr."expiresAt" <= ${new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)}
      ORDER BY cr."expiresAt" ASC
      LIMIT 10
    `,
    // Pending tasks — the clinician's own draft (un-finalized) clinical notes.
    prisma.$queryRaw<
      { id: string; template: string; updatedAt: Date; patientFirstName: string; patientLastName: string }[]
    >`
      SELECT m.id, m.template, m."updatedAt",
             p."firstName" AS "patientFirstName", p."lastName" AS "patientLastName"
      FROM medical_records m
      JOIN users p ON p.id = m."patientId"
      WHERE m."clinicianId" = ${uid}::uuid
        AND m.status = 'draft'
        AND m."deletedAt" IS NULL
        AND m."updatedAt" >= ${past}
      ORDER BY m."updatedAt" DESC
      LIMIT 10
    `,
  ]);

  // Decided consent requests where I'm the requesting clinician (last 14d).
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

  // Incoming patient messages (Messages category).
  for (const m of msgs) {
    const patient = `${m.patientFirstName} ${m.patientLastName}`.trim();
    out.push({
      id: `msg-${m.id}`,
      category: "message",
      title: `New message from ${patient}`,
      body: (m.body ?? "").trim().slice(0, 80) || "Sent you an attachment",
      time: relativeTime(m.sentAt),
      href: "/clinician/messages",
      read: !!m.readAt,
    });
  }

  // Patient-cancelled appointments (Schedule category).
  for (const a of cancelled) {
    out.push({
      id: `apc-${a.id}`,
      category: "appointment",
      title: `${a.patientName ?? "A patient"} cancelled their appointment`,
      body: a.startsAt.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      time: relativeTime(a.updatedAt),
      href: "/clinician/schedule",
    });
  }

  // Patient-rescheduled appointments — back to `requested`, needs reconfirm.
  for (const a of rescheduled) {
    out.push({
      id: `apr-${a.id}`,
      category: "appointment",
      title: `${a.patientName ?? "A patient"} rescheduled — needs your confirmation`,
      body: `New time: ${a.startsAt.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
      time: relativeTime(a.updatedAt),
      href: "/clinician/schedule",
    });
  }

  // Consents expiring within 7 days (Consent requests category).
  for (const e of expiring) {
    const patient = `${e.patientFirstName} ${e.patientLastName}`.trim();
    out.push({
      id: `ce-${e.id}`,
      category: "consent",
      title: `Consent expiring soon`,
      body: `${patient}'s ${fmtScopes(e.scopes)} · expires ${e.expiresAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      time: relativeTime(e.expiresAt),
      href: `/clinician/patients`,
    });
  }

  // Pending tasks — draft notes awaiting finalization (Tasks & reviews).
  for (const n of draftNotes) {
    const patient = `${n.patientFirstName} ${n.patientLastName}`.trim();
    out.push({
      id: `task-note-${n.id}`,
      category: "task",
      title: `Draft ${n.template} note to finalize`,
      body: `For ${patient} · open the chart to review & sign`,
      time: relativeTime(n.updatedAt),
      href: "/clinician/notes",
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

  // The two tenant feeds are independent → fetch in parallel.
  const [users, assigns] = await Promise.all([
    prisma.$queryRaw<
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
    `,
    prisma.$queryRaw<
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
    `,
  ]);

  // New users in my tenant (patients + staff) in last 14d.
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

  // Both tenant feeds are independent → fetch in parallel.
  const [pending, decided] = await Promise.all([
    prisma.$queryRaw<
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
    `,
    prisma.$queryRaw<
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
    `,
  ]);

  // Pending consent requests in tenant (anything not yet decided).
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

  // Both tenant feeds are independent → fetch in parallel.
  const [decided, appts] = await Promise.all([
    prisma.$queryRaw<
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
    `,
    prisma.$queryRaw<
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
    `,
  ]);

  // Consent decisions feed.
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

  // All feeds are independent → fetch in parallel.
  const [tenants, suspended, admins] = await Promise.all([
    prisma.$queryRaw<{ id: string; name: string; createdAt: Date }[]>`
      SELECT id, name, "createdAt"
      FROM organizations
      WHERE "createdAt" >= ${past}
      ORDER BY "createdAt" DESC
      LIMIT 15
    `,
    // Tenant lifecycle: currently-suspended tenants (recently changed).
    prisma.$queryRaw<{ id: string; name: string; updatedAt: Date }[]>`
      SELECT id, name, "updatedAt"
      FROM organizations
      WHERE status = 'suspended'::"TenantStatus"
        AND "archivedAt" IS NULL
        AND "updatedAt" >= ${past}
      ORDER BY "updatedAt" DESC
      LIMIT 10
    `,
    prisma.$queryRaw<
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
    `,
  ]);

  // Tenant lifecycle — onboarding (new tenants) + suspensions, tagged with the
  // `tenants` category so the Settings → Alerts "Tenant lifecycle" toggle
  // governs them.
  for (const t of tenants) {
    out.push({
      id: `tn-${t.id}`,
      category: "tenants",
      title: `Tenant onboarded: ${t.name}`,
      body: "Configure billing tier and onboarding link from the tenant detail page",
      time: relativeTime(t.createdAt),
      href: `/super/tenants/${t.id}`,
    });
  }
  for (const s of suspended) {
    out.push({
      id: `sp-${s.id}`,
      category: "tenants",
      title: `Tenant suspended: ${s.name}`,
      body: "Review the suspension on the tenant detail page",
      time: relativeTime(s.updatedAt),
      href: `/super/tenants/${s.id}`,
    });
  }

  // Recent org-admin signups (across all tenants) — part of the onboarding
  // lifecycle, so also under `tenants`.
  for (const a of admins) {
    const name = `${a.firstName} ${a.lastName}`.trim();
    out.push({
      id: `oa-${a.id}`,
      category: "tenants",
      title: `Org admin onboarded: ${name}`,
      body: a.orgName ?? "Unassigned tenant",
      time: relativeTime(a.createdAt),
      href: "/super/tenants",
    });
  }

  return out;
}

/**
 * Maps a derived-feed `category` to the per-user preference key shown in
 * Settings → Notifications. Anything not listed (or with no saved pref) keeps
 * the channel default (in-app ON) — so the filter only ever hides categories
 * the user explicitly turned off; it never hides something unexpectedly.
 */
const FEED_TO_PREF_KEY: Record<string, string> = {
  appointment: "appointments",
  consent: "consents",
  message: "messages",
  record: "records",
  security: "security", // critical → always on (clamped in prefChannelOn)
  audit: "audit",
  system: "system",
  approval: "approvals",
  tenants: "tenants",
  task: "tasks",
};

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

    // Honour the viewer's IN-APP toggle per category (Settings → Notifications):
    // drop items whose category's in-app channel is off. `security`/`incidents`
    // are clamped on by prefChannelOn, so critical alerts are never hidden.
    const prefRows = await prisma.$queryRaw<{ prefs: Prisma.JsonValue }[]>`
      SELECT prefs FROM notification_preferences WHERE "userId" = ${claims.uid}::uuid LIMIT 1
    `;
    const prefs = prefRows[0]?.prefs ?? null;
    items = items.filter((n) => prefChannelOn(prefs, FEED_TO_PREF_KEY[n.category] ?? n.category, "inApp"));

    // Most recent first.
    items.sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0));
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("[api/notifications] failed:", err);
    return NextResponse.json({ ok: true, items: [] });
  }
}
