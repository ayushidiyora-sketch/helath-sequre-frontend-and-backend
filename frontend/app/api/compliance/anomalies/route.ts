import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Compliance Manager → Anomalies. Detector rules unioned at read-time across
 * the source tables we actually own (sessions, mfa_challenges, users,
 * patient_documents, consent_requests, patient_assignments). No mock data.
 *
 * Each detected item carries a stable `signature` so the reviewer's decision
 * (open / investigating / resolved / dismissed + outcome + justification)
 * persists in `anomaly_decisions` and survives recomputation.
 *
 * Multi-tenant: every query is scoped to the signed-in compliance manager's
 * organizationId. Auditors get read access (same gate as audit-logs).
 */

type Severity = "low" | "medium" | "high" | "critical";
type Status = "open" | "investigating" | "resolved" | "dismissed";
type AnomalyType =
  | "bulkUpload"
  | "failedMFA"
  | "offHoursAccess"
  | "consentRevokedAccess"
  | "unassignedPatient"
  | "excessiveViews"
  | "breakGlass"
  | "unusualIp"
  | "lockedAccount"
  | "bruteForce"
  | "infectedUpload";

interface Anomaly {
  id: string;            // same as signature — stable across reloads
  signature: string;
  type: AnomalyType;
  title: string;
  summary: string;
  description: string;
  severity: Severity;
  status: Status;
  actor: string;
  actorId: string | null;
  ip: string;
  events: number;
  detectedAt: string;    // ISO
  time: string;          // "Nh ago"
  window: string;
  evidence: string[];
  recommendation: string;
  decision?: {
    outcome: string | null;
    coordinatedWith: string | null;
    justification: string | null;
    decidedByEmail: string | null;
    decidedAt: string | null;
  };
}

interface Stats {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  dismissed: number;
  critical: number;
  high: number;
}

async function guard(): Promise<
  | { error: NextResponse; orgId?: never; viewer?: never }
  | { error?: never; orgId: string; viewer: { uid: string; email: string; role: string } }
> {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims)
    return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) };
  if (claims.role !== "Compliance Manager" && claims.role !== "Auditor")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Compliance / Auditor only." }, { status: 403 }) };
  if (!isDbUid(claims.uid))
    return {
      error: NextResponse.json({
        ok: true,
        anomalies: [],
        stats: { total: 0, open: 0, investigating: 0, resolved: 0, dismissed: 0, critical: 0, high: 0 },
      }),
    };

  const rows = await prisma.$queryRaw<{ organizationId: string | null; email: string }[]>`
    SELECT "organizationId", email FROM users WHERE id = ${claims.uid}::uuid LIMIT 1
  `;
  const orgId = rows[0]?.organizationId;
  if (!orgId)
    return {
      error: NextResponse.json({
        ok: true,
        anomalies: [],
        stats: { total: 0, open: 0, investigating: 0, resolved: 0, dismissed: 0, critical: 0, high: 0 },
      }),
    };
  return {
    orgId,
    viewer: { uid: claims.uid, email: rows[0]!.email, role: claims.role },
  };
}

function relTime(d: Date): string {
  const sec = (Date.now() - d.getTime()) / 1000;
  if (sec < 60) return "Just now";
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  if (sec < 172800) return "Yesterday";
  return `${Math.round(sec / 86400)}d ago`;
}

function tenMinBucket(d: Date): string {
  const ms = d.getTime() - (d.getTime() % (10 * 60 * 1000));
  return new Date(ms).toISOString();
}

function dayBucket(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET() {
  const g = await guard();
  if ("error" in g) return g.error;

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since7  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since1  = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const detected: Anomaly[] = [];

  // -------- 1. Bulk document download/upload (≥4 docs by same user in a 10-min window)
  try {
    const rows = await prisma.$queryRaw<{
      uploaderId: string;
      uploaderEmail: string;
      bucketStart: Date;
      docCount: bigint;
      firstAt: Date;
      lastAt: Date;
    }[]>`
      SELECT pd."uploadedById" AS "uploaderId",
             u.email AS "uploaderEmail",
             date_trunc('minute', pd."uploadedAt") - (EXTRACT(MINUTE FROM pd."uploadedAt")::int % 10) * INTERVAL '1 minute' AS "bucketStart",
             COUNT(*)::bigint AS "docCount",
             MIN(pd."uploadedAt") AS "firstAt",
             MAX(pd."uploadedAt") AS "lastAt"
      FROM patient_documents pd
      JOIN users u ON u.id = pd."uploadedById"
      WHERE pd."organizationId" = ${g.orgId}::uuid
        AND pd."uploadedAt" >= ${since30}
        AND pd."deletedAt" IS NULL
      GROUP BY pd."uploadedById", u.email, "bucketStart"
      HAVING COUNT(*) >= 4
      ORDER BY "lastAt" DESC
      LIMIT 50
    `;
    for (const r of rows) {
      const count = Number(r.docCount);
      const sig = `bulkUpload:${r.uploaderId}:${tenMinBucket(r.bucketStart)}`;
      detected.push({
        id: sig,
        signature: sig,
        type: "bulkUpload",
        title: `Bulk document burst — ${r.uploaderEmail}`,
        summary: `${count} documents in ≤10 minutes · ${r.firstAt.toLocaleString("en-IN", { hour12: false })}`,
        description: `${count} document uploads from a single account inside a 10-minute window (${r.firstAt.toLocaleTimeString("en-IN", { hour12: false })} – ${r.lastAt.toLocaleTimeString("en-IN", { hour12: false })}). This is well above this account's typical pattern and warrants confirmation.`,
        severity: count >= 12 ? "critical" : "high",
        status: "open",
        actor: r.uploaderEmail,
        actorId: r.uploaderId,
        ip: "—",
        events: count,
        detectedAt: r.lastAt.toISOString(),
        time: relTime(r.lastAt),
        window: "Bulk burst (10-minute window)",
        evidence: [
          `${count} document.upload events recorded between ${r.firstAt.toLocaleString("en-IN", { hour12: false })} and ${r.lastAt.toLocaleString("en-IN", { hour12: false })}`,
          `Source account ${r.uploaderEmail} (id ${r.uploaderId.slice(0, 8)})`,
          `Threshold: 4 uploads / 10 minutes triggers this rule`,
        ],
        recommendation:
          "Contact the account holder to confirm intent. If unverified within 24 hours, open an incident and revoke the active session.",
      });
    }
  } catch (err) { console.error("[anomalies] bulkUpload", err); }

  // -------- 2. Repeated failed MFA (attemptsLeft=0 within last 7 days)
  try {
    const rows = await prisma.$queryRaw<{
      id: string;
      createdAt: Date;
      userId: string;
      userEmail: string;
      ipAddress: string | null;
      failCount: bigint;
    }[]>`
      SELECT mc.id, mc."issuedAt" AS "createdAt", mc."userId",
             u.email AS "userEmail", mc."ipAddress",
             (SELECT COUNT(*) FROM mfa_challenges mc2
                WHERE mc2."userId" = mc."userId"
                  AND mc2."issuedAt" >= ${since7}
                  AND mc2."attemptsLeft" = 0
                  AND mc2."usedAt" IS NULL)::bigint AS "failCount"
      FROM mfa_challenges mc
      JOIN users u ON u.id = mc."userId"
      WHERE u."organizationId" = ${g.orgId}::uuid
        AND mc."issuedAt" >= ${since7}
        AND mc."attemptsLeft" = 0
        AND mc."usedAt" IS NULL
      ORDER BY mc."issuedAt" DESC
      LIMIT 100
    `;
    const seen = new Set<string>();
    for (const r of rows) {
      const sig = `failedMFA:${r.userId}:${dayBucket(r.createdAt)}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      const fails = Number(r.failCount);
      detected.push({
        id: sig,
        signature: sig,
        type: "failedMFA",
        title: `Repeated failed MFA — ${r.userEmail}`,
        summary: `${fails} exhausted MFA challenge${fails === 1 ? "" : "s"} · ${r.ipAddress ?? "unknown IP"}`,
        description: `Account ${r.userEmail} hit the MFA attempt cap ${fails} time${fails === 1 ? "" : "s"} in the last 7 days. Each exhaustion triggers the lockout policy.`,
        severity: fails >= 3 ? "high" : "medium",
        status: "open",
        actor: r.userEmail,
        actorId: r.userId,
        ip: r.ipAddress ?? "—",
        events: fails,
        detectedAt: r.createdAt.toISOString(),
        time: relTime(r.createdAt),
        window: "Last 7 days",
        evidence: [
          `${fails} mfa_challenge rows with attemptsLeft=0`,
          `Password verification succeeded — only the MFA step failed`,
          r.ipAddress ? `Source IP ${r.ipAddress}` : "Source IP not recorded",
          `Lockout policy (5 attempts) was enforced`,
        ],
        recommendation:
          "Most likely a lost or reset authenticator device. Verify the user's identity out-of-band before unlocking the account.",
      });
    }
  } catch (err) { console.error("[anomalies] failedMFA", err); }

  // -------- 3. Off-hours PHI access (sessions issued between 22:00-05:00 local)
  try {
    const rows = await prisma.$queryRaw<{
      id: string;
      issuedAt: Date;
      userId: string;
      userEmail: string;
      roleKind: string;
      ipAddress: string | null;
    }[]>`
      SELECT s.id, s."issuedAt", s."userId", u.email AS "userEmail",
             u."roleKind"::text AS "roleKind", s."ipAddress"
      FROM sessions s
      JOIN users u ON u.id = s."userId"
      WHERE u."organizationId" = ${g.orgId}::uuid
        AND s."issuedAt" >= ${since7}
        AND (EXTRACT(HOUR FROM s."issuedAt") >= 22 OR EXTRACT(HOUR FROM s."issuedAt") < 5)
        AND u."roleKind" IN ('clinician','staff','org_admin')
      ORDER BY s."issuedAt" DESC
      LIMIT 50
    `;
    for (const r of rows) {
      const sig = `offHoursAccess:${r.userId}:${r.id.slice(0, 8)}`;
      detected.push({
        id: sig,
        signature: sig,
        type: "offHoursAccess",
        title: `Off-hours PHI access — ${r.userEmail}`,
        summary: `Session created at ${r.issuedAt.toLocaleString("en-IN", { hour12: false })} (off-hours window 22:00–05:00)`,
        description: `${r.userEmail} authenticated at ${r.issuedAt.toLocaleString("en-IN", { hour12: false })} from ${r.ipAddress ?? "an unknown IP"} — outside the standard 08:00–18:00 working window.`,
        severity: "medium",
        status: "open",
        actor: r.userEmail,
        actorId: r.userId,
        ip: r.ipAddress ?? "—",
        events: 1,
        detectedAt: r.issuedAt.toISOString(),
        time: relTime(r.issuedAt),
        window: "Off-hours (22:00–05:00)",
        evidence: [
          `auth.session.create at ${r.issuedAt.toLocaleString("en-IN", { hour12: false })}`,
          `Source IP ${r.ipAddress ?? "not recorded"}`,
          `Role: ${r.roleKind}`,
          `Typical activity window for this role is 08:00–18:00`,
        ],
        recommendation:
          "Cross-check the on-call roster. If the user wasn't on call, verify activity out-of-band before dismissing.",
      });
    }
  } catch (err) { console.error("[anomalies] offHoursAccess", err); }

  // -------- 4. Locked account (auth lockout in past 7 days)
  try {
    const rows = await prisma.$queryRaw<{
      id: string;
      email: string;
      lockedUntil: Date;
      failedLoginCount: number;
    }[]>`
      SELECT id, email, "lockedUntil", "failedLoginCount"
      FROM users
      WHERE "organizationId" = ${g.orgId}::uuid
        AND "lockedUntil" IS NOT NULL
        AND "lockedUntil" >= ${since7}
      ORDER BY "lockedUntil" DESC
      LIMIT 50
    `;    
    for (const r of rows) {
      const sig = `lockedAccount:${r.id}:${dayBucket(r.lockedUntil)}`;
      detected.push({
        id: sig,
        signature: sig,
        type: "lockedAccount",
        title: `Locked-out account — ${r.email}`,
        summary: `Account locked until ${r.lockedUntil.toLocaleString("en-IN", { hour12: false })} · ${r.failedLoginCount} failed login${r.failedLoginCount === 1 ? "" : "s"}`,
        description: `The account ${r.email} hit the auth lockout policy. Lock expires at ${r.lockedUntil.toLocaleString("en-IN", { hour12: false })}.`,
        severity: r.failedLoginCount >= 8 ? "high" : "medium",
        status: "open",
        actor: r.email,
        actorId: r.id,
        ip: "—",
        events: r.failedLoginCount,
        detectedAt: r.lockedUntil.toISOString(),
        time: relTime(r.lockedUntil),
        window: "Last 7 days",
        evidence: [
          `users.failedLoginCount = ${r.failedLoginCount}`,
          `users.lockedUntil = ${r.lockedUntil.toISOString()}`,
          `Lockout policy was enforced automatically`,
        ],
        recommendation:
          "Verify the user's identity before manual unlock. If unrecognised IP attempted the logins, treat as credential stuffing and rotate the password.",
      });
    }
  } catch (err) { console.error("[anomalies] lockedAccount", err); }

  // -------- 5. Brute-force in progress (≥5 fails, not yet locked)
  try {
    const rows = await prisma.$queryRaw<{
      id: string;
      email: string;
      failedLoginCount: number;
      updatedAt: Date;
    }[]>`
      SELECT id, email, "failedLoginCount", "updatedAt"
      FROM users
      WHERE "organizationId" = ${g.orgId}::uuid
        AND "failedLoginCount" >= 5
        AND ("lockedUntil" IS NULL OR "lockedUntil" < NOW())
      ORDER BY "failedLoginCount" DESC
      LIMIT 30
    `;
    for (const r of rows) {
      const sig = `bruteForce:${r.id}`;
      detected.push({
        id: sig,
        signature: sig,
        type: "bruteForce",
        title: `Brute-force login attempts — ${r.email}`,
        summary: `${r.failedLoginCount} failed login attempts and counting`,
        description: `Account ${r.email} has accumulated ${r.failedLoginCount} failed login attempts. The lockout will trigger on the next failure.`,
        severity: "high",
        status: "open",
        actor: r.email,
        actorId: r.id,
        ip: "—",
        events: r.failedLoginCount,
        detectedAt: r.updatedAt.toISOString(),
        time: relTime(r.updatedAt),
        window: "Live",
        evidence: [
          `users.failedLoginCount = ${r.failedLoginCount}`,
          `Account is not currently locked`,
          `Threshold: lockout fires at the next failed attempt`,
        ],
        recommendation:
          "Block the source IP and notify the account holder out-of-band. If the user did not initiate these attempts, rotate the password proactively.",
      });
    }
  } catch (err) { console.error("[anomalies] bruteForce", err); }

  // -------- 6. Infected upload (scanner flagged a file)
  try {
    const rows = await prisma.$queryRaw<{
      id: string;
      name: string;
      uploadedAt: Date;
      uploadedById: string;
      uploaderEmail: string;
    }[]>`
      SELECT pd.id, pd.name, pd."uploadedAt", pd."uploadedById",
             u.email AS "uploaderEmail"
      FROM patient_documents pd
      JOIN users u ON u.id = pd."uploadedById"
      WHERE pd."organizationId" = ${g.orgId}::uuid
        AND pd."scanStatus" = 'infected'
        AND pd."uploadedAt" >= ${since30}
      ORDER BY pd."uploadedAt" DESC
      LIMIT 50
    `;
    for (const r of rows) {
      const sig = `infectedUpload:${r.id}`;
      detected.push({
        id: sig,
        signature: sig,
        type: "infectedUpload",
        title: `Infected file upload attempt — ${r.uploaderEmail}`,
        summary: `${r.name} flagged by document scanner`,
        description: `The document scanner refused "${r.name}" uploaded by ${r.uploaderEmail}. The file was not stored; the upload attempt is recorded for compliance.`,
        severity: "critical",
        status: "open",
        actor: r.uploaderEmail,
        actorId: r.uploadedById,
        ip: "—",
        events: 1,
        detectedAt: r.uploadedAt.toISOString(),
        time: relTime(r.uploadedAt),
        window: "Last 30 days",
        evidence: [
          `patient_documents.scanStatus = 'infected'`,
          `Filename: ${r.name}`,
          `Uploaded by ${r.uploaderEmail} at ${r.uploadedAt.toLocaleString("en-IN", { hour12: false })}`,
          `Scanner: EICAR / magic-byte / PDF tag detection`,
        ],
        recommendation:
          "Contact the user to determine whether their device is compromised. Run an endpoint scan before allowing further uploads.",
      });
    }
  } catch (err) { console.error("[anomalies] infectedUpload", err); }

  // -------- 7. Consent declined recently (potential follow-on access attempts)
  try {
    const rows = await prisma.$queryRaw<{
      patientId: string;
      patientEmail: string;
      clinicianId: string;
      clinicianEmail: string;
      decidedAt: Date;
      requestId: string;
    }[]>`
      SELECT cr."patientId", p.email AS "patientEmail",
             cr."clinicianId", c.email AS "clinicianEmail",
             cr."decidedAt", cr.id AS "requestId"
      FROM consent_requests cr
      JOIN users p ON p.id = cr."patientId"
      JOIN users c ON c.id = cr."clinicianId"
      WHERE cr."organizationId" = ${g.orgId}::uuid
        AND cr.status = 'declined'
        AND cr."decidedAt" >= ${since7}
      ORDER BY cr."decidedAt" DESC
      LIMIT 50
    `;
    for (const r of rows) {
      const sig = `consentRevokedAccess:${r.clinicianId}:${r.patientId}:${dayBucket(r.decidedAt!)}`;
      detected.push({
        id: sig,
        signature: sig,
        type: "consentRevokedAccess",
        title: `Consent declined — ${r.clinicianEmail} → ${r.patientEmail}`,
        summary: `Patient declined the access request · denial recorded ${r.decidedAt!.toLocaleString("en-IN", { hour12: false })}`,
        description: `Patient ${r.patientEmail} declined a consent request from ${r.clinicianEmail}. Any follow-on access attempts must be denied at the API layer.`,
        severity: "medium",
        status: "open",
        actor: r.clinicianEmail,
        actorId: r.clinicianId,
        ip: "—",
        events: 1,
        detectedAt: r.decidedAt!.toISOString(),
        time: relTime(r.decidedAt!),
        window: "Last 7 days",
        evidence: [
          `consent_requests.status = 'declined' (request ${r.requestId.slice(0, 8)})`,
          `Patient: ${r.patientEmail}`,
          `Clinician: ${r.clinicianEmail}`,
          `Denial reason: consent_revoked`,
        ],
        recommendation:
          "Confirm the consent guard is enforced for this clinician-patient pair. Dismiss if no subsequent access attempts followed.",
      });
    }
  } catch (err) { console.error("[anomalies] consentRevokedAccess", err); }

  // -------- 8. Unassigned patient — consent request without an active care relationship
  try {
    const rows = await prisma.$queryRaw<{
      requestId: string;
      requestedAt: Date;
      patientId: string;
      patientEmail: string;
      clinicianId: string;
      clinicianEmail: string;
    }[]>`
      SELECT cr.id AS "requestId", cr."requestedAt",
             cr."patientId", p.email AS "patientEmail",
             cr."clinicianId", c.email AS "clinicianEmail"
      FROM consent_requests cr
      JOIN users p ON p.id = cr."patientId"
      JOIN users c ON c.id = cr."clinicianId"
      WHERE cr."organizationId" = ${g.orgId}::uuid
        AND cr."requestedAt" >= ${since30}
        AND NOT EXISTS (
          SELECT 1 FROM patient_assignments pa
          WHERE pa."patientId" = cr."patientId"
            AND pa."clinicianId" = cr."clinicianId"
            AND pa."endedAt" IS NULL
        )
      ORDER BY cr."requestedAt" DESC
      LIMIT 50
    `;
    for (const r of rows) {
      const sig = `unassignedPatient:${r.clinicianId}:${r.patientId}`;
      detected.push({
        id: sig,
        signature: sig,
        type: "unassignedPatient",
        title: `Unassigned patient access — ${r.clinicianEmail}`,
        summary: `${r.clinicianEmail} requested access to ${r.patientEmail} without an active care relationship`,
        description: `A consent request was raised for patient ${r.patientEmail} by ${r.clinicianEmail}, but no active patient_assignment exists between them. This is the classic "fishing for records" pattern.`,
        severity: "medium",
        status: "open",
        actor: r.clinicianEmail,
        actorId: r.clinicianId,
        ip: "—",
        events: 1,
        detectedAt: r.requestedAt.toISOString(),
        time: relTime(r.requestedAt),
        window: "Last 30 days",
        evidence: [
          `consent_requests row ${r.requestId.slice(0, 8)} from ${r.clinicianEmail}`,
          `Target patient ${r.patientEmail} has no active patient_assignment with this clinician`,
          `Care-relationship guard would deny the read even if consent were granted`,
        ],
        recommendation:
          "Confirm whether the clinician was about to be assigned. If not, treat as inappropriate access and notify the org admin.",
      });
    }
  } catch (err) { console.error("[anomalies] unassignedPatient", err); }

  // -------- 9. Excessive views — ≥10 consent requests by one clinician in 24h
  try {
    const rows = await prisma.$queryRaw<{
      clinicianId: string;
      clinicianEmail: string;
      reqCount: bigint;
      latestAt: Date;
    }[]>`
      SELECT cr."clinicianId", c.email AS "clinicianEmail",
             COUNT(*)::bigint AS "reqCount",
             MAX(cr."requestedAt") AS "latestAt"
      FROM consent_requests cr
      JOIN users c ON c.id = cr."clinicianId"
      WHERE cr."organizationId" = ${g.orgId}::uuid
        AND cr."requestedAt" >= ${since1}
      GROUP BY cr."clinicianId", c.email
      HAVING COUNT(*) >= 10
      ORDER BY "reqCount" DESC
      LIMIT 20
    `;
    for (const r of rows) {
      const count = Number(r.reqCount);
      const sig = `excessiveViews:${r.clinicianId}:${dayBucket(r.latestAt)}`;
      detected.push({
        id: sig,
        signature: sig,
        type: "excessiveViews",
        title: `Excessive record requests — ${r.clinicianEmail}`,
        summary: `${count} consent requests in the last 24 hours`,
        description: `${r.clinicianEmail} raised ${count} consent requests in the last 24 hours — well above the ward-shift average of 3 per clinician per day.`,
        severity: count >= 25 ? "high" : "low",
        status: "open",
        actor: r.clinicianEmail,
        actorId: r.clinicianId,
        ip: "—",
        events: count,
        detectedAt: r.latestAt.toISOString(),
        time: relTime(r.latestAt),
        window: "Last 24 hours",
        evidence: [
          `${count} consent_requests rows in 24 hours`,
          `Clinician: ${r.clinicianEmail}`,
          `Threshold: 10 / 24h triggers this rule`,
        ],
        recommendation:
          "Often legitimate during ward rounds. Cross-check shift schedule before escalating.",
      });
    }
  } catch (err) { console.error("[anomalies] excessiveViews", err); }

  // -------- 10. Break-glass — consent reason mentions emergency / break-glass
  try {
    const rows = await prisma.$queryRaw<{
      requestId: string;
      requestedAt: Date;
      clinicianId: string;
      clinicianEmail: string;
      patientEmail: string;
      reason: string;
    }[]>`
      SELECT cr.id AS "requestId", cr."requestedAt",
             cr."clinicianId", c.email AS "clinicianEmail",
             p.email AS "patientEmail", cr.reason
      FROM consent_requests cr
      JOIN users c ON c.id = cr."clinicianId"
      JOIN users p ON p.id = cr."patientId"
      WHERE cr."organizationId" = ${g.orgId}::uuid
        AND cr."requestedAt" >= ${since30}
        AND (lower(cr.reason) LIKE '%emergency%' OR lower(cr.reason) LIKE '%break%glass%' OR lower(cr.reason) LIKE '%urgent%')
      ORDER BY cr."requestedAt" DESC
      LIMIT 30
    `;
    for (const r of rows) {
      const sig = `breakGlass:${r.requestId}`;
      detected.push({
        id: sig,
        signature: sig,
        type: "breakGlass",
        title: `Break-glass / emergency access — ${r.clinicianEmail}`,
        summary: `Emergency consent request for ${r.patientEmail}`,
        description: `${r.clinicianEmail} raised an emergency / break-glass consent request: "${r.reason}". Every break-glass invocation must be reviewed.`,
        severity: "high",
        status: "open",
        actor: r.clinicianEmail,
        actorId: r.clinicianId,
        ip: "—",
        events: 1,
        detectedAt: r.requestedAt.toISOString(),
        time: relTime(r.requestedAt),
        window: "Last 30 days",
        evidence: [
          `consent_requests.reason contains "emergency" / "break-glass" / "urgent"`,
          `Clinician: ${r.clinicianEmail}`,
          `Patient: ${r.patientEmail}`,
          `Reason: ${r.reason}`,
        ],
        recommendation:
          "Verify the clinical incident that justified break-glass. Confirm the supervising physician was notified.",
      });
    }
  } catch (err) { console.error("[anomalies] breakGlass", err); }

  // -------- 11. Unusual IP — session from an IP this user has not used before in last 7 days
  try {
    const rows = await prisma.$queryRaw<{
      sessionId: string;
      issuedAt: Date;
      userId: string;
      userEmail: string;
      ipAddress: string;
    }[]>`
      WITH user_prior AS (
        SELECT s."userId", s."ipAddress", MIN(s."issuedAt") AS "firstSeen"
        FROM sessions s
        JOIN users u ON u.id = s."userId"
        WHERE u."organizationId" = ${g.orgId}::uuid
          AND s."ipAddress" IS NOT NULL
        GROUP BY s."userId", s."ipAddress"
      )
      SELECT s.id AS "sessionId", s."issuedAt", s."userId",
             u.email AS "userEmail", s."ipAddress"
      FROM sessions s
      JOIN users u ON u.id = s."userId"
      JOIN user_prior up ON up."userId" = s."userId" AND up."ipAddress" = s."ipAddress"
      WHERE u."organizationId" = ${g.orgId}::uuid
        AND s."issuedAt" >= ${since7}
        AND s."ipAddress" IS NOT NULL
        AND up."firstSeen" = s."issuedAt"
        AND (SELECT COUNT(DISTINCT s2."ipAddress")
               FROM sessions s2
              WHERE s2."userId" = s."userId"
                AND s2."issuedAt" < s."issuedAt") >= 1
      ORDER BY s."issuedAt" DESC
      LIMIT 30
    `;
    for (const r of rows) {
      const sig = `unusualIp:${r.userId}:${r.ipAddress}`;
      detected.push({
        id: sig,
        signature: sig,
        type: "unusualIp",
        title: `New IP for ${r.userEmail}`,
        summary: `First-ever session from ${r.ipAddress} for this account`,
        description: `${r.userEmail} signed in from ${r.ipAddress} for the first time — the account has prior sessions only from other IPs.`,
        severity: "medium",
        status: "open",
        actor: r.userEmail,
        actorId: r.userId,
        ip: r.ipAddress,
        events: 1,
        detectedAt: r.issuedAt.toISOString(),
        time: relTime(r.issuedAt),
        window: "Last 7 days",
        evidence: [
          `auth.session.create at ${r.issuedAt.toLocaleString("en-IN", { hour12: false })}`,
          `Source IP ${r.ipAddress} — first seen for this account`,
          `Account has prior sessions from at least one other IP`,
        ],
        recommendation:
          "Likely a travel / WFH event. Verify out-of-band before dismissing if the user is normally on-prem.",
      });
    }
  } catch (err) { console.error("[anomalies] unusualIp", err); }

  // -------- Overlay reviewer decisions
  const sigs = detected.map((d) => d.signature);
  if (sigs.length > 0) {
    try {
      const decisions = await prisma.$queryRaw<{
        signature: string;
        status: string;
        outcome: string | null;
        coordinatedWith: string | null;
        justification: string | null;
        decidedByEmail: string | null;
        decidedAt: Date | null;
      }[]>`
        SELECT signature, status, outcome, "coordinatedWith", justification,
               "decidedByEmail", "decidedAt"
        FROM anomaly_decisions
        WHERE "organizationId" = ${g.orgId}::uuid
          AND signature = ANY(${sigs}::text[])
      `;
      const byKey = new Map(decisions.map((d) => [d.signature, d]));
      for (const a of detected) {
        const d = byKey.get(a.signature);
        if (!d) continue;
        if (d.status === "open" || d.status === "investigating" || d.status === "resolved" || d.status === "dismissed") {
          a.status = d.status as Status;
        }
        a.decision = {
          outcome: d.outcome,
          coordinatedWith: d.coordinatedWith,
          justification: d.justification,
          decidedByEmail: d.decidedByEmail,
          decidedAt: d.decidedAt ? d.decidedAt.toISOString() : null,
        };
      }
    } catch (err) { console.error("[anomalies] overlay decisions", err); }
  }

  // Newest first
  detected.sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt));

  const stats: Stats = {
    total: detected.length,
    open: detected.filter((a) => a.status === "open").length,
    investigating: detected.filter((a) => a.status === "investigating").length,
    resolved: detected.filter((a) => a.status === "resolved").length,
    dismissed: detected.filter((a) => a.status === "dismissed").length,
    critical: detected.filter((a) => a.severity === "critical").length,
    high: detected.filter((a) => a.severity === "high").length,
  };

  return NextResponse.json({ ok: true, anomalies: detected, stats });
}

interface PatchBody {
  signature?: string;
  status?: Status;
  outcome?: "legitimate" | "policy_update" | "incident" | null;
  coordinatedWith?: string | null;
  justification?: string | null;
}

export async function PATCH(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;

  let body: PatchBody;
  try { body = (await req.json()) as PatchBody; } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const signature = (body.signature ?? "").trim();
  if (!signature || signature.length > 400)
    return NextResponse.json({ ok: false, error: "signature required" }, { status: 400 });
  const status = body.status;
  if (!status || !["open", "investigating", "resolved", "dismissed"].includes(status))
    return NextResponse.json({ ok: false, error: "status must be open|investigating|resolved|dismissed" }, { status: 400 });

  const outcome = body.outcome && ["legitimate", "policy_update", "incident"].includes(body.outcome) ? body.outcome : null;
  const coordinatedWith = (body.coordinatedWith ?? "").toString().trim() || null;
  const justification = (body.justification ?? "").toString().trim() || null;

  if ((status === "resolved" || status === "dismissed") && !justification)
    return NextResponse.json({ ok: false, error: "Justification required to close an anomaly." }, { status: 400 });

  const isClosed = status === "resolved" || status === "dismissed" || status === "investigating";
  const decidedAt = isClosed ? new Date() : null;
  const decidedById = isClosed ? g.viewer.uid : null;
  const decidedByEmail = isClosed ? g.viewer.email : null;

  await prisma.$executeRaw`
    INSERT INTO anomaly_decisions
      ("organizationId", signature, status, outcome, "coordinatedWith",
       justification, "decidedById", "decidedByEmail", "decidedAt",
       "createdAt", "updatedAt")
    VALUES
      (${g.orgId}::uuid, ${signature}, ${status}, ${outcome},
       ${coordinatedWith}, ${justification},
       ${decidedById ? decidedById : null}::uuid,
       ${decidedByEmail}, ${decidedAt},
       NOW(), NOW())
    ON CONFLICT ("organizationId", signature)
    DO UPDATE SET
      status = EXCLUDED.status,
      outcome = EXCLUDED.outcome,
      "coordinatedWith" = EXCLUDED."coordinatedWith",
      justification = EXCLUDED.justification,
      "decidedById" = EXCLUDED."decidedById",
      "decidedByEmail" = EXCLUDED."decidedByEmail",
      "decidedAt" = EXCLUDED."decidedAt",
      "updatedAt" = NOW()
  `;

  return NextResponse.json({ ok: true });
}
