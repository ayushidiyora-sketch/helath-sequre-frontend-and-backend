import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession, type SessionClaims } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";

export const runtime = "nodejs";

/**
 * Resolve `claims.uid` to a real DB user id. The demo Super Admin (`u_super_ayushi`)
 * doesn't have a Postgres row, so its non-UUID uid would blow up `::uuid` casts.
 * On first call we lazy-provision a `super_admin` row for the demo account using
 * its email; subsequent calls just look it up.
 */
async function ensureRealOperator(claims: SessionClaims): Promise<{ id: string; email: string }> {
  const email = claims.email.trim().toLowerCase();
  if (isDbUid(claims.uid)) {
    const [row] = await prisma.$queryRaw<{ id: string; email: string }[]>`
      SELECT id, email FROM users WHERE id = ${claims.uid}::uuid LIMIT 1
    `;
    if (row) return row;
  }
  // Either claims.uid is non-UUID (demo) or the row was deleted — fall back to email.
  const [byEmail] = await prisma.$queryRaw<{ id: string; email: string }[]>`
    SELECT id, email FROM users WHERE LOWER(email) = ${email} LIMIT 1
  `;
  if (byEmail) return byEmail;
  // Lazy-provision a super_admin row. Demo Super Admin has no organization.
  const [created] = await prisma.$queryRaw<{ id: string; email: string }[]>`
    INSERT INTO users (
      id, email, "passwordHash", "firstName", "lastName",
      "roleKind", status, "mfaRequired", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), ${email}, '',
      ${claims.name.split(" ")[0] ?? "Super"},
      ${claims.name.split(" ").slice(1).join(" ") || "Admin"},
      'super_admin'::"RoleKind", 'active'::"UserStatus", true, NOW(), NOW()
    )
    RETURNING id, email
  `;
  return created;
}

/**
 * Super Admin → Break-glass module — list + initiate endpoints.
 *
 * GET  /api/super/break-glass    → active session + recent sessions + tenants list
 *                                  Also lazy-closes any expired session (so the
 *                                  page always reflects the truth without a cron).
 *
 * POST /api/super/break-glass    → initiate a new break-glass session
 *                                  Body: { targetOrgId, incidentRef?, justification, acknowledged }
 *                                  Validates: 50-char min justification, ack=true, no existing
 *                                  active session for this operator, target tenant exists.
 *                                  Side effects:
 *                                    1. Inserts row in `break_glass_sessions` (status=active,
 *                                       expiresAt = NOW()+30min, mfaChallengeAt = NOW()+15min)
 *                                    2. Writes an `anomaly_decisions` row with signature
 *                                       `breakGlass:<sessionId>` so the Super Security stream
 *                                       picks it up as a HIGH event.
 *                                    3. Best-effort emails the target tenant's Compliance Manager(s).
 */

interface Body {
  targetOrgId?: string;
  incidentRef?: string;
  justification?: string;
  acknowledged?: boolean;
}

interface OperatorRow {
  id: string;
  email: string;
}

interface OrgRow {
  id: string;
  slug: string;
  name: string;
}

interface SessionRow {
  id: string;
  displayId: string;
  operatorId: string;
  operatorEmail: string;
  targetOrgId: string;
  incidentRef: string | null;
  justification: string;
  status: string;
  startedAt: Date;
  expiresAt: Date;
  mfaChallengeAt: Date;
  mfaVerifiedAt: Date | null;
  closedAt: Date | null;
  closeReason: string | null;
  orgSlug: string | null;
  orgName: string | null;
  operatorFirst: string | null;
  operatorLast: string | null;
}

function pad(n: number, w: number): string {
  return String(n).padStart(w, "0");
}

async function lazyExpire(): Promise<void> {
  // Sweep any active row whose expiresAt has passed — flip to 'expired' and
  // stamp closedAt. This is the no-cron equivalent of the spec's TTL job.
  await prisma.$executeRaw`
    UPDATE break_glass_sessions
    SET status = 'expired', "closedAt" = NOW(), "closeReason" = 'expired', "updatedAt" = NOW()
    WHERE status = 'active' AND "expiresAt" < NOW()
  `;
  // +15m re-MFA enforcement: any active session past mfaChallengeAt + 120s
  // grace WITHOUT mfaVerifiedAt is auto-closed. Operators that fail / skip
  // the re-MFA prompt lose the session — matches the spec's "MFA at +15m
  // required" guard. 120s grace covers slow typing + clock drift.
  await prisma.$executeRaw`
    UPDATE break_glass_sessions
    SET status = 'closed',
        "closedAt" = NOW(),
        "closeReason" = 'mfa_timeout',
        "updatedAt" = NOW()
    WHERE status = 'active'
      AND "mfaVerifiedAt" IS NULL
      AND "mfaChallengeAt" + INTERVAL '120 seconds' < NOW()
  `;
}

async function nextDisplayId(): Promise<string> {
  const [row] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM break_glass_sessions
  `;
  const n = (row?.n ?? 0) + 1;
  return `BG-${pad(n, 4)}`;
}

function shape(s: SessionRow, opUid: string) {
  const operatorName =
    [s.operatorFirst, s.operatorLast].filter(Boolean).join(" ") || s.operatorEmail;
  return {
    id: s.id,
    displayId: s.displayId,
    operatorId: s.operatorId,
    operatorEmail: s.operatorEmail,
    operatorName,
    isYou: s.operatorId === opUid,
    targetOrgId: s.targetOrgId,
    targetOrgSlug: s.orgSlug,
    targetOrgName: s.orgName,
    incidentRef: s.incidentRef,
    justification: s.justification,
    status: s.status,
    startedAt: s.startedAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    mfaChallengeAt: s.mfaChallengeAt.toISOString(),
    mfaVerifiedAt: s.mfaVerifiedAt ? s.mfaVerifiedAt.toISOString() : null,
    closedAt: s.closedAt ? s.closedAt.toISOString() : null,
    closeReason: s.closeReason,
  };
}

export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  if (claims.role !== "Super Admin") {
    return NextResponse.json({ ok: false, error: "Forbidden — Super Admin only." }, { status: 403 });
  }

  try {
    await lazyExpire();

    // Resolve the operator id we should match against for "is this MY active
    // session?". Falls back to claims.uid if we can't find a DB row yet (so the
    // demo user just sees an empty active state until they Initiate).
    let opDbId: string = claims.uid;
    try {
      const op = await ensureRealOperator(claims);
      opDbId = op.id;
    } catch (err) {
      console.warn("[break-glass GET] could not resolve operator", err);
    }

    const sessions = await prisma.$queryRaw<SessionRow[]>`
      SELECT
        b.id, b."displayId", b."operatorId", b."operatorEmail",
        b."targetOrgId", b."incidentRef", b.justification, b.status,
        b."startedAt", b."expiresAt", b."mfaChallengeAt", b."mfaVerifiedAt",
        b."closedAt", b."closeReason",
        o.slug AS "orgSlug", o.name AS "orgName",
        u."firstName" AS "operatorFirst", u."lastName" AS "operatorLast"
      FROM break_glass_sessions b
      LEFT JOIN organizations o ON o.id = b."targetOrgId"
      LEFT JOIN users u ON u.id = b."operatorId"
      ORDER BY b."startedAt" DESC
      LIMIT 25
    `;

    const tenants = await prisma.$queryRaw<OrgRow[]>`
      SELECT id, slug, name FROM organizations
      WHERE status = 'active'::"TenantStatus"
      ORDER BY name ASC
    `;

    const active = sessions.find((s) => s.status === "active" && s.operatorId === opDbId) ?? null;
    const recent = sessions.filter((s) => !active || s.id !== active.id).slice(0, 10);

    // If the operator has an active session, also return the reads they've
    // tagged so far (and recent reads across recent sessions — capped at 30).
    interface ReadRow {
      id: string;
      sessionId: string;
      sessionDisplay: string;
      endpoint: string;
      queryParams: string | null;
      recordCount: number;
      readAt: Date;
    }
    let reads: ReadRow[] = [];
    if (sessions.length > 0) {
      reads = await prisma.$queryRaw<ReadRow[]>`
        SELECT r.id, r."sessionId", b."displayId" AS "sessionDisplay",
               r.endpoint, r."queryParams", r."recordCount", r."readAt"
        FROM break_glass_reads r
        JOIN break_glass_sessions b ON b.id = r."sessionId"
        WHERE r."operatorId" = ${opDbId}::uuid
        ORDER BY r."readAt" DESC
        LIMIT 30
      `;
    }

    return NextResponse.json({
      ok: true,
      active: active ? shape(active, opDbId) : null,
      recent: recent.map((s) => shape(s, opDbId)),
      tenants: tenants.map((t) => ({ id: t.id, slug: t.slug, name: t.name })),
      reads: reads.map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        sessionDisplay: r.sessionDisplay,
        endpoint: r.endpoint,
        queryParams: r.queryParams,
        recordCount: r.recordCount,
        readAt: r.readAt.toISOString(),
      })),
      serverNow: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[break-glass GET] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  if (claims.role !== "Super Admin") {
    return NextResponse.json({ ok: false, error: "Forbidden — Super Admin only." }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const targetOrgId = (body.targetOrgId ?? "").trim();
  const incidentRef = (body.incidentRef ?? "").trim().slice(0, 32) || null;
  const justification = (body.justification ?? "").trim();
  const acknowledged = body.acknowledged === true;

  if (!acknowledged) {
    return NextResponse.json(
      { ok: false, error: "You must acknowledge the HIPAA / termination warning." },
      { status: 400 },
    );
  }
  if (!/^[0-9a-f-]{36}$/i.test(targetOrgId)) {
    return NextResponse.json({ ok: false, error: "Pick a target tenant." }, { status: 400 });
  }
  if (justification.length < 50) {
    return NextResponse.json(
      { ok: false, error: "Justification must be at least 50 characters." },
      { status: 400 },
    );
  }
  if (justification.length > 1000) {
    return NextResponse.json(
      { ok: false, error: "Justification too long (max 1000 chars)." },
      { status: 400 },
    );
  }

  let operator: OperatorRow;
  let inserted: { id: string };
  let org: { id: string; slug: string; name: string };
  let displayId: string;

  try {
    operator = await ensureRealOperator(claims);

    await lazyExpire();

    // Block if the operator already has an active session.
    const [existing] = await prisma.$queryRaw<{ id: string; displayId: string }[]>`
      SELECT id, "displayId" FROM break_glass_sessions
      WHERE "operatorId" = ${operator.id}::uuid AND status = 'active'
      LIMIT 1
    `;
    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          error: `You already have an active break-glass session (${existing.displayId}). Close it before opening a new one.`,
        },
        { status: 409 },
      );
    }

    // Confirm target tenant exists.
    const orgRows = await prisma.$queryRaw<{ id: string; slug: string; name: string }[]>`
      SELECT id, slug, name FROM organizations WHERE id = ${targetOrgId}::uuid LIMIT 1
    `;
    if (orgRows.length === 0) {
      return NextResponse.json({ ok: false, error: "Target tenant not found." }, { status: 404 });
    }
    org = orgRows[0];

    displayId = await nextDisplayId();

    // Insert session row — 30 min cap, MFA re-challenge at +15 min.
    const insRows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO break_glass_sessions (
        "displayId", "operatorId", "operatorEmail", "targetOrgId",
        "incidentRef", justification, status,
        "startedAt", "expiresAt", "mfaChallengeAt"
      ) VALUES (
        ${displayId}, ${operator.id}::uuid, ${operator.email}, ${org.id}::uuid,
        ${incidentRef}, ${justification}, 'active',
        NOW(), NOW() + INTERVAL '30 minutes', NOW() + INTERVAL '15 minutes'
      )
      RETURNING id
    `;
    inserted = insRows[0];
  } catch (err) {
    console.error("[break-glass POST] insert flow failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }

  // Write an anomaly_decisions row so the Super Security stream picks this
  // up as a HIGH `break_glass.start` event. The signature pattern matches
  // the SIG_PREFIX map in /api/super/security/route.ts.
  try {
    await prisma.$executeRaw`
      INSERT INTO anomaly_decisions (
        "organizationId", signature, status, "createdAt", "updatedAt"
      ) VALUES (
        ${org.id}::uuid,
        ${"breakGlass:" + inserted.id},
        'investigating', NOW(), NOW()
      )
      ON CONFLICT ("organizationId", signature) DO NOTHING
    `;
  } catch (err) {
    console.error("[break-glass] anomaly_decisions insert failed:", err);
  }

  // Notify the tenant's Compliance Manager(s). Best-effort — log on failure.
  try {
    const cms = await prisma.$queryRaw<{ email: string }[]>`
      SELECT email FROM users
      WHERE "organizationId" = ${org.id}::uuid
        AND "roleKind" = 'compliance_manager'
        AND status = 'active'::"UserStatus"
    `;
    if (cms.length > 0) {
      const subject = `URGENT: Break-glass session opened on ${org.name} by ${operator.email}`;
      const text = [
        `A Sensussoft Super Admin has opened a break-glass session on your tenant.`,
        ``,
        `Session: ${displayId}`,
        `Operator: ${operator.email}`,
        `Tenant: ${org.name} (${org.slug})`,
        `Incident reference: ${incidentRef ?? "(none)"}`,
        `Window: 30 minutes (auto-closes at ${new Date(Date.now() + 30 * 60_000).toISOString()})`,
        `Re-MFA challenge: 15 minutes in`,
        ``,
        `Justification (provided by operator):`,
        justification,
        ``,
        `Every PHI read during this session is tagged break_glass=true in the audit ledger.`,
        `If you suspect misuse, sign in and force-close the session from the Super Admin break-glass page.`,
      ].join("\n");
      await Promise.all(
        cms.map((cm) =>
          sendMail({ to: cm.email, subject, text }).catch((e) => {
            console.error(`[break-glass] mail to ${cm.email} failed:`, e);
          }),
        ),
      );
    }
  } catch (err) {
    console.error("[break-glass] CM notification fan-out failed:", err);
  }

  return NextResponse.json({
    ok: true,
    sessionId: inserted.id,
    displayId,
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    mfaChallengeAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  });
}
