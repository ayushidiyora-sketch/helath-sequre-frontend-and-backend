import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Compliance Manager → Audit ledger. Since the project doesn't yet have an
 * `audit_logs` table, this endpoint UNIONs the actual state-changing tables
 * (consent decisions, appointments, prescriptions, notes, messages, doc
 * uploads, MFA failures, session creations, incidents) at read-time into a
 * single chronological feed, scoped to the compliance manager's tenant. Each
 * row carries the standard audit fields: time, actor, role, action verb,
 * resource, ip, status, flag.
 */

interface AuditEvent {
  id: string;
  ts: string;          // ISO
  time: string;        // "HH:MM:SS" local
  actor: string;       // email
  role: string;        // "Clinician" | "Patient" | ...
  action: string;      // verb code (e.g. "consent.approve")
  resource: string;
  ip: string;
  status: "success" | "denied" | "failure";
  flag?: "anomaly";
  sessionId: string;
}

interface Stats {
  events24h: number;
  denied: number;
  failures: number;
  anomalies: number;
}

interface RawRow {
  ts: Date;
  actor: string | null;
  role: string;
  action: string;
  resource: string;
  ip: string | null;
  status: string;
  flag: string | null;
}

async function guard(): Promise<
  | { error: NextResponse; orgId?: never }
  | { error?: never; orgId: string }
> {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims)
    return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) };
  if (claims.role !== "Compliance Manager" && claims.role !== "Auditor")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Compliance / Auditor only." }, { status: 403 }) };
  if (!isDbUid(claims.uid))
    return { error: NextResponse.json({ ok: true, events: [], stats: { events24h: 0, denied: 0, failures: 0, anomalies: 0 } }) };

  // Resolve tenant from the signed-in user's record.
  const rows = await prisma.$queryRaw<{ organizationId: string | null }[]>`
    SELECT "organizationId" FROM users WHERE id = ${claims.uid}::uuid LIMIT 1
  `;
  const orgId = rows[0]?.organizationId;
  if (!orgId)
    return { error: NextResponse.json({ ok: true, events: [], stats: { events24h: 0, denied: 0, failures: 0, anomalies: 0 } }) };
  return { orgId };
}

// HH:MM:SS in Asia/Kolkata (IST) regardless of the server's process timezone.
// The audit ledger is read by Indian auditors so we format in their wall-clock.
function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
}

export async function GET() {
  const g = await guard();
  if ("error" in g) return g.error;

  // We pull the last 30 days of source rows and union them in JS — cheaper
  // than a SQL UNION across 8 schemas with different shapes, and gives us a
  // single place to compute statuses/flags consistently.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const raws: RawRow[] = [];

  // 1. Consent decisions
  try {
    const rows = await prisma.$queryRaw<{
      decidedAt: Date | null;
      requestedAt: Date;
      status: string;
      patientEmail: string;
      clinicianEmail: string;
      requestId: string;
    }[]>`
      SELECT cr."decidedAt", cr."requestedAt", cr.status, cr.id AS "requestId",
             p.email AS "patientEmail", c.email AS "clinicianEmail"
      FROM consent_requests cr
      JOIN users p ON p.id = cr."patientId"
      JOIN users c ON c.id = cr."clinicianId"
      WHERE cr."organizationId" = ${g.orgId}::uuid
        AND cr."requestedAt" >= ${since}
      ORDER BY cr."requestedAt" DESC
      LIMIT 200
    `;
    for (const r of rows) {
      raws.push({
        ts: r.requestedAt,
        actor: r.clinicianEmail,
        role: "Clinician",
        action: "consent.request",
        resource: r.requestId.slice(0, 8),
        ip: null,
        status: "success",
        flag: null,
      });
      if (r.decidedAt) {
        raws.push({
          ts: r.decidedAt,
          actor: r.patientEmail,
          role: "Patient",
          action: r.status === "approved" ? "consent.approve" : r.status === "declined" ? "consent.decline" : "consent.update",
          resource: r.requestId.slice(0, 8),
          ip: null,
          status: r.status === "declined" ? "denied" : "success",
          flag: null,
        });
      }
    }
  } catch (err) { console.error("[audit-logs] consent_requests", err); }

  // 2. Appointments (created)
  try {
    const rows = await prisma.$queryRaw<{
      id: string;
      createdAt: Date;
      patientEmail: string | null;
      clinicianEmail: string;
    }[]>`
      SELECT a.id, a."createdAt", a."patientEmail", c.email AS "clinicianEmail"
      FROM appointments a
      JOIN users c ON c.id = a."clinicianId"
      WHERE a."organizationId" = ${g.orgId}::uuid
        AND a."createdAt" >= ${since}
        AND a."deletedAt" IS NULL
      ORDER BY a."createdAt" DESC
      LIMIT 100
    `;
    for (const r of rows) {
      raws.push({
        ts: r.createdAt,
        actor: r.patientEmail ?? r.clinicianEmail,
        role: r.patientEmail ? "Patient" : "Clinician",
        action: "appointment.create",
        resource: r.id.slice(0, 8),
        ip: null,
        status: "success",
        flag: null,
      });
    }
  } catch (err) { console.error("[audit-logs] appointments", err); }

  // 3. Prescriptions (finalized)
  try {
    const rows = await prisma.$queryRaw<{
      id: string;
      finalizedAt: Date | null;
      createdAt: Date;
      drugName: string;
      clinicianEmail: string;
    }[]>`
      SELECT p.id, p."finalizedAt", p."createdAt", p."drugName",
             c.email AS "clinicianEmail"
      FROM prescriptions p
      JOIN users c ON c.id = p."clinicianId"
      WHERE p."organizationId" = ${g.orgId}::uuid
        AND p."createdAt" >= ${since}
        AND p."deletedAt" IS NULL
      ORDER BY p."createdAt" DESC
      LIMIT 100
    `;
    for (const r of rows) {
      raws.push({
        ts: r.finalizedAt ?? r.createdAt,
        actor: r.clinicianEmail,
        role: "Clinician",
        action: r.finalizedAt ? "prescription.finalize" : "prescription.draft",
        resource: r.id.slice(0, 8),
        ip: null,
        status: "success",
        flag: null,
      });
    }
  } catch (err) { console.error("[audit-logs] prescriptions", err); }

  // 4. Clinical notes
  try {
    const rows = await prisma.$queryRaw<{
      id: string;
      finalizedAt: Date | null;
      createdAt: Date;
      clinicianEmail: string;
    }[]>`
      SELECT m.id, m."finalizedAt", m."createdAt",
             c.email AS "clinicianEmail"
      FROM medical_records m
      JOIN users c ON c.id = m."clinicianId"
      WHERE m."organizationId" = ${g.orgId}::uuid
        AND m."createdAt" >= ${since}
        AND m."deletedAt" IS NULL
      ORDER BY m."createdAt" DESC
      LIMIT 100
    `;
    for (const r of rows) {
      raws.push({
        ts: r.finalizedAt ?? r.createdAt,
        actor: r.clinicianEmail,
        role: "Clinician",
        action: r.finalizedAt ? "note.finalize" : "note.draft",
        resource: r.id.slice(0, 8),
        ip: null,
        status: "success",
        flag: null,
      });
    }
  } catch (err) { console.error("[audit-logs] medical_records", err); }

  // 5. Messages
  try {
    const rows = await prisma.$queryRaw<{
      id: string;
      sentAt: Date;
      senderRole: string;
      patientEmail: string;
      clinicianEmail: string;
    }[]>`
      SELECT msg.id, msg."sentAt", msg."senderRole",
             p.email AS "patientEmail", c.email AS "clinicianEmail"
      FROM messages msg
      JOIN users p ON p.id = msg."patientId"
      JOIN users c ON c.id = msg."clinicianId"
      WHERE msg."organizationId" = ${g.orgId}::uuid
        AND msg."sentAt" >= ${since}
      ORDER BY msg."sentAt" DESC
      LIMIT 100
    `;
    for (const r of rows) {
      raws.push({
        ts: r.sentAt,
        actor: r.senderRole === "patient" ? r.patientEmail : r.clinicianEmail,
        role: r.senderRole === "patient" ? "Patient" : "Clinician",
        action: "message.send",
        resource: r.id.slice(0, 8),
        ip: null,
        status: "success",
        flag: null,
      });
    }
  } catch (err) { console.error("[audit-logs] messages", err); }

  // 6. Patient document uploads
  try {
    const rows = await prisma.$queryRaw<{
      id: string;
      uploadedAt: Date;
      scanStatus: string;
      fileName: string;
      patientEmail: string;
    }[]>`
      SELECT d.id, d."uploadedAt", d."scanStatus", d."fileName",
             u.email AS "patientEmail"
      FROM patient_documents d
      LEFT JOIN users u ON u.id = d."patientId"
      WHERE d."organizationId" = ${g.orgId}::uuid
        AND d."uploadedAt" >= ${since}
        AND d."deletedAt" IS NULL
      ORDER BY d."uploadedAt" DESC
      LIMIT 100
    `;
    for (const r of rows) {
      const isInfected = r.scanStatus === "infected";
      raws.push({
        ts: r.uploadedAt,
        actor: r.patientEmail,
        role: "Patient",
        action: isInfected ? "documents.upload_infected" : "documents.upload",
        resource: r.fileName.slice(0, 40),
        ip: null,
        status: isInfected ? "failure" : "success",
        flag: isInfected ? "anomaly" : null,
      });
    }
  } catch (err) { console.error("[audit-logs] patient_documents", err); }

  // 7. MFA challenges exhausted
  try {
    const rows = await prisma.$queryRaw<{
      id: string;
      createdAt: Date;
      attemptsLeft: number;
      userEmail: string;
    }[]>`
      SELECT mc.id, mc."issuedAt" AS "createdAt", mc."attemptsLeft", u.email AS "userEmail"
      FROM mfa_challenges mc
      JOIN users u ON u.id = mc."userId"
      WHERE u."organizationId" = ${g.orgId}::uuid
        AND mc."issuedAt" >= ${since}
        AND mc."attemptsLeft" = 0
        AND mc."usedAt" IS NULL
      ORDER BY mc."issuedAt" DESC
      LIMIT 100
    `;
    for (const r of rows) {
      raws.push({
        ts: r.createdAt,
        actor: r.userEmail,
        role: "Staff",
        action: "auth.mfa_failure",
        resource: r.id.slice(0, 8),
        ip: null,
        status: "failure",
        flag: "anomaly",
      });
    }
  } catch (err) { console.error("[audit-logs] mfa_challenges", err); }

  // 8. Sessions (logins)
  try {
    const rows = await prisma.$queryRaw<{
      id: string;
      issuedAt: Date;
      ipAddress: string | null;
      userEmail: string;
    }[]>`
      SELECT s.id, s."issuedAt", s."ipAddress", u.email AS "userEmail"
      FROM sessions s
      JOIN users u ON u.id = s."userId"
      WHERE u."organizationId" = ${g.orgId}::uuid
        AND s."issuedAt" >= ${since}
      ORDER BY s."issuedAt" DESC
      LIMIT 100
    `;
    for (const r of rows) {
      raws.push({
        ts: r.issuedAt,
        actor: r.userEmail,
        role: "Staff",
        action: "auth.session.create",
        resource: r.id.slice(0, 8),
        ip: r.ipAddress,
        status: "success",
        flag: null,
      });
    }
  } catch (err) { console.error("[audit-logs] sessions", err); }

  // 9. Locked users → access denials
  try {
    const rows = await prisma.$queryRaw<{
      id: string;
      lockedUntil: Date;
      email: string;
    }[]>`
      SELECT id, "lockedUntil", email FROM users
      WHERE "organizationId" = ${g.orgId}::uuid
        AND "lockedUntil" IS NOT NULL
        AND "lockedUntil" >= ${since}
      ORDER BY "lockedUntil" DESC
      LIMIT 50
    `;
    for (const r of rows) {
      raws.push({
        ts: r.lockedUntil,
        actor: r.email,
        role: "Staff",
        action: "auth.account_locked",
        resource: r.id.slice(0, 8),
        ip: null,
        status: "denied",
        flag: "anomaly",
      });
    }
  } catch (err) { console.error("[audit-logs] users locked", err); }

  // Sort all rows descending by timestamp
  raws.sort((a, b) => b.ts.getTime() - a.ts.getTime());

  // Shape into AuditEvent payload.
  const events: AuditEvent[] = raws.slice(0, 500).map((r, i) => ({
    id: `evt_${r.ts.getTime().toString(16)}_${i}`,
    ts: r.ts.toISOString(),
    time: fmtTime(r.ts),
    actor: r.actor ?? "—",
    role: r.role,
    action: r.action,
    resource: r.resource,
    ip: r.ip ?? "—",
    status: (r.status === "denied" || r.status === "failure" ? r.status : "success") as AuditEvent["status"],
    flag: r.flag === "anomaly" ? "anomaly" : undefined,
    sessionId: `sess_${r.ts.getTime().toString(36)}`,
  }));

  // Stats from the last 24 hours
  const day = Date.now() - 24 * 60 * 60 * 1000;
  const dayEvents = events.filter((e) => Date.parse(e.ts) >= day);
  const stats: Stats = {
    events24h: dayEvents.length,
    denied: dayEvents.filter((e) => e.status === "denied").length,
    failures: dayEvents.filter((e) => e.status === "failure").length,
    anomalies: dayEvents.filter((e) => e.flag === "anomaly").length,
  };

  return NextResponse.json({ ok: true, events, stats });
}
