import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";

export const runtime = "nodejs";

/**
 * Parse a `scope` string like "tenant:org_slug" into its parts so we can
 * resolve the organization and notify its Compliance Manager(s). Other shapes
 * ("platform", "region:ap-south-1", null) return null — no per-tenant fan-out.
 */
function scopeOrgSlug(scope: string | null | undefined): string | null {
  if (!scope) return null;
  const m = scope.match(/^tenant:([\w_-]+)$/i);
  return m ? m[1] : null;
}

/**
 * Best-effort: send `subject/text` to every active Compliance Manager in the
 * tenant identified by `orgSlug`. Swallows errors so the calling handler
 * never 500s because of a transient mail-provider issue.
 */
async function emailTenantComplianceManagers(
  orgSlug: string,
  subject: string,
  text: string,
): Promise<void> {
  try {
    const cms = await prisma.$queryRaw<{ email: string }[]>`
      SELECT u.email
      FROM users u
      JOIN organizations o ON o.id = u."organizationId"
      WHERE o.slug = ${orgSlug}
        AND u."roleKind" = 'compliance_manager'
        AND u.status = 'active'::"UserStatus"
    `;
    if (cms.length === 0) return;
    await Promise.all(
      cms.map((cm) =>
        sendMail({ to: cm.email, subject, text }).catch((e) => {
          console.error(`[incidents] mail to ${cm.email} failed:`, e);
        }),
      ),
    );
  } catch (err) {
    console.error("[incidents] CM notification fan-out failed:", err);
  }
}

/**
 * Super Admin incidents feed. Combines:
 *   1. Manual incidents from the `incidents` table (created via the
 *      "Open incident" dialog; status mutable via PATCH).
 *   2. Auto-derived incidents from live signals (locked accounts, brute-force
 *      patterns, exhausted MFA, infected uploads, suspended tenants). These
 *      are computed at read-time — they self-resolve when the underlying
 *      condition clears.
 */

interface Incident {
  id: string;
  /** "INC-0023" display number */
  display: string;
  title: string;
  /** "high" | "medium" | "minor" */
  severity: string;
  /** "open" | "investigating" | "mitigating" | "monitoring" | "resolved" */
  status: string;
  scope: string | null;
  /** Optional URL the "Open runbook" button navigates to. */
  runbookUrl: string | null;
  /** "manual" — has a DB row · "auto" — derived from a live signal */
  source: "manual" | "auto";
  openedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  /** Free-form for the row: commander, last-actor, etc. */
  context: string;
}

async function requireSuperAdmin() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims || claims.role !== "Super Admin") {
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Super Admin only." }, { status: 403 }) } as const;
  }
  return { claims } as const;
}

function relativeTime(iso: string | Date): string {
  const t = typeof iso === "string" ? Date.parse(iso) : iso.getTime();
  const min = Math.round((Date.now() - t) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

interface ManualRow {
  id: string;
  number: number;
  title: string;
  severity: string;
  status: string;
  scope: string | null;
  runbookUrl: string | null;
  openedAt: Date;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  openerFirstName: string | null;
  openerLastName: string | null;
}

/* ---------- auto-derived signals ---------- */

interface LockRow { id: string; firstName: string; lastName: string; lockedUntil: Date; orgName: string | null }
interface FailRow { id: string; firstName: string; lastName: string; failedLoginCount: number; updatedAt: Date; orgName: string | null }
interface MfaRow  { id: string; userFirst: string; userLast: string; createdAt: Date }
interface DocRow  { id: string; fileName: string; uploadedAt: Date; orgName: string | null }
interface TenRow  { id: string; name: string; archivedAt: Date }

async function deriveAuto(): Promise<{ active: Incident[]; closed: Incident[] }> {
  const active: Incident[] = [];
  const closed: Incident[] = [];

  // 1. Locked accounts — currently locked = active "investigating"; recently expired = closed.
  const locks = await prisma.$queryRaw<LockRow[]>`
    SELECT u.id, u."firstName", u."lastName", u."lockedUntil", o.name AS "orgName"
    FROM users u LEFT JOIN organizations o ON o.id = u."organizationId"
    WHERE u."lockedUntil" IS NOT NULL
      AND u."lockedUntil" > NOW() - INTERVAL '30 days'
      AND u."deletedAt" IS NULL
    ORDER BY u."lockedUntil" DESC
    LIMIT 50
  `;
  for (const r of locks) {
    const stillLocked = r.lockedUntil.getTime() > Date.now();
    const inc: Incident = {
      id: `auto-lock-${r.id}`,
      display: `LOCK-${r.id.slice(0, 4).toUpperCase()}`,
      title: `Account locked — ${r.firstName} ${r.lastName}${r.orgName ? ` · ${r.orgName}` : ""}`,
      severity: "high",
      status: stillLocked ? "investigating" : "resolved",
      scope: r.orgName ? `tenant:${r.orgName}` : "platform",
      runbookUrl: null,
      source: "auto",
      openedAt: r.lockedUntil.toISOString(),
      resolvedAt: stillLocked ? null : r.lockedUntil.toISOString(),
      resolutionNote: stillLocked ? null : "Lock auto-expired",
      context: stillLocked ? `Auto · expires ${relativeTime(r.lockedUntil)}` : `Auto · expired ${relativeTime(r.lockedUntil)}`,
    };
    if (stillLocked) active.push(inc);
    else closed.push(inc);
  }

  // 2. Brute-force pattern — failedLoginCount >= 5 AND not currently locked.
  const fails = await prisma.$queryRaw<FailRow[]>`
    SELECT u.id, u."firstName", u."lastName", u."failedLoginCount", u."updatedAt", o.name AS "orgName"
    FROM users u LEFT JOIN organizations o ON o.id = u."organizationId"
    WHERE u."failedLoginCount" >= 5
      AND (u."lockedUntil" IS NULL OR u."lockedUntil" < NOW())
      AND u."updatedAt" > NOW() - INTERVAL '24 hours'
      AND u."deletedAt" IS NULL
    ORDER BY u."updatedAt" DESC
    LIMIT 25
  `;
  for (const r of fails) {
    active.push({
      id: `auto-fail-${r.id}`,
      display: `BRUTE-${r.id.slice(0, 4).toUpperCase()}`,
      title: `Brute-force pattern · ${r.firstName} ${r.lastName}${r.orgName ? ` · ${r.orgName}` : ""}`,
      severity: "high",
      status: "investigating",
      scope: r.orgName ? `tenant:${r.orgName}` : "platform",
      runbookUrl: null,
      source: "auto",
      openedAt: r.updatedAt.toISOString(),
      resolvedAt: null,
      resolutionNote: null,
      context: `Auto · ${r.failedLoginCount} failed attempts`,
    });
  }

  // 3. Exhausted MFA challenges (last 1h).
  const mfas = await prisma.$queryRaw<MfaRow[]>`
    SELECT mc.id, u."firstName" AS "userFirst", u."lastName" AS "userLast", mc."createdAt"
    FROM mfa_challenges mc
    JOIN users u ON u.id = mc."userId"
    WHERE mc."attemptsLeft" = 0
      AND mc."createdAt" > NOW() - INTERVAL '1 hour'
    ORDER BY mc."createdAt" DESC
    LIMIT 25
  `;
  for (const r of mfas) {
    active.push({
      id: `auto-mfa-${r.id}`,
      display: `MFA-${r.id.slice(0, 4).toUpperCase()}`,
      title: `MFA exhaustion · ${r.userFirst} ${r.userLast}`,
      severity: "medium",
      status: "investigating",
      scope: "platform",
      runbookUrl: null,
      source: "auto",
      openedAt: r.createdAt.toISOString(),
      resolvedAt: null,
      resolutionNote: null,
      context: `Auto · OTP attempts exhausted`,
    });
  }

  // 4. Infected document uploads.
  const docs = await prisma.$queryRaw<DocRow[]>`
    SELECT d.id, d."fileName", d."uploadedAt", o.name AS "orgName"
    FROM patient_documents d
    LEFT JOIN users u ON u.id = d."patientId"
    LEFT JOIN organizations o ON o.id = u."organizationId"
    WHERE d."scanStatus" = 'infected'
      AND d."deletedAt" IS NULL
      AND d."uploadedAt" > NOW() - INTERVAL '30 days'
    ORDER BY d."uploadedAt" DESC
    LIMIT 25
  `;
  for (const r of docs) {
    active.push({
      id: `auto-doc-${r.id}`,
      display: `MAL-${r.id.slice(0, 4).toUpperCase()}`,
      title: `Malware detected · ${r.fileName}${r.orgName ? ` · ${r.orgName}` : ""}`,
      severity: "high",
      status: "mitigating",
      scope: r.orgName ? `tenant:${r.orgName}` : "platform",
      runbookUrl: null,
      source: "auto",
      openedAt: r.uploadedAt.toISOString(),
      resolvedAt: null,
      resolutionNote: null,
      context: `Auto · ClamAV / scan result`,
    });
  }

  // 5. Recently suspended tenants (last 7d).
  const tens = await prisma.$queryRaw<TenRow[]>`
    SELECT id, name, "archivedAt"
    FROM organizations
    WHERE "archivedAt" IS NOT NULL
      AND "archivedAt" > NOW() - INTERVAL '7 days'
    ORDER BY "archivedAt" DESC
    LIMIT 25
  `;
  for (const r of tens) {
    active.push({
      id: `auto-tenant-${r.id}`,
      display: `TEN-${r.id.slice(0, 4).toUpperCase()}`,
      title: `Tenant suspended · ${r.name}`,
      severity: "minor",
      status: "monitoring",
      scope: `tenant:${r.name}`,
      runbookUrl: null,
      source: "auto",
      openedAt: r.archivedAt.toISOString(),
      resolvedAt: null,
      resolutionNote: null,
      context: `Auto · org archived`,
    });
  }

  return { active, closed };
}

/* ---------- handlers ---------- */

export async function GET() {
  const g = await requireSuperAdmin();
  if ("error" in g) return g.error;

  // Manual rows from the incidents table.
  const rows = await prisma.$queryRaw<ManualRow[]>`
    SELECT i.id, i.number, i.title, i.severity, i.status, i.scope, i."runbookUrl",
           i."openedAt", i."resolvedAt", i."resolutionNote",
           u."firstName" AS "openerFirstName",
           u."lastName"  AS "openerLastName"
    FROM incidents i
    LEFT JOIN users u ON u.id = i."openedBy"
    WHERE i."openedAt" > NOW() - INTERVAL '90 days'
    ORDER BY i."openedAt" DESC
    LIMIT 200
  `;
  const manualActive: Incident[] = [];
  const manualClosed: Incident[] = [];
  for (const r of rows) {
    const display = `INC-${String(r.number).padStart(4, "0")}`;
    const inc: Incident = {
      id: r.id,
      display,
      title: r.title,
      severity: r.severity,
      status: r.status,
      scope: r.scope,
      runbookUrl: r.runbookUrl,
      source: "manual",
      openedAt: r.openedAt.toISOString(),
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      resolutionNote: r.resolutionNote,
      context: r.openerFirstName ? `${r.openerFirstName} ${r.openerLastName ?? ""}`.trim() : "Manual",
    };
    if (r.status === "resolved") manualClosed.push(inc);
    else manualActive.push(inc);
  }

  // Auto-derived signals (never throws — failures of any subquery are caught
  // and the rest still surface).
  let auto: { active: Incident[]; closed: Incident[] } = { active: [], closed: [] };
  try {
    auto = await deriveAuto();
  } catch (err) {
    console.error("[api/super/incidents] derive failed:", err);
  }

  return NextResponse.json({
    ok: true,
    active: [...manualActive, ...auto.active].sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
    closed: [...manualClosed, ...auto.closed].sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
  });
}

interface PostBody {
  title?: string;
  severity?: string;
  scope?: string | null;
  runbookUrl?: string | null;
}

export async function POST(req: Request) {
  const g = await requireSuperAdmin();
  if ("error" in g) return g.error;

  let body: PostBody;
  try { body = (await req.json()) as PostBody; } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const title = body.title?.trim() ?? "";
  if (!title) return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });
  if (title.length > 240) return NextResponse.json({ ok: false, error: "Title too long." }, { status: 400 });
  const severityRaw = (body.severity ?? "minor").toLowerCase();
  const severity = ["high", "medium", "minor"].includes(severityRaw) ? severityRaw : "minor";
  const scope = body.scope?.trim() || null;
  const runbookUrl = body.runbookUrl?.trim() || null;
  if (runbookUrl && runbookUrl.length > 500) {
    return NextResponse.json({ ok: false, error: "Runbook URL too long (max 500)." }, { status: 400 });
  }
  // Demo Super Admin (seeded user) has a non-UUID uid → store openedBy=NULL.
  // `Prisma.sql` builds the correct SQL fragment for either case.
  const openedByFragment = isDbUid(g.claims.uid)
    ? Prisma.sql`${g.claims.uid}::uuid`
    : Prisma.sql`NULL`;

  const inserted = await prisma.$queryRaw<{ id: string; number: number; openedAt: Date }[]>`
    INSERT INTO incidents
      (id, title, severity, status, scope, "runbookUrl", "openedBy",
       "openedAt", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), ${title}, ${severity}, 'open', ${scope}, ${runbookUrl},
       ${openedByFragment}, NOW(), NOW(), NOW())
    RETURNING id, number, "openedAt"
  `;
  const display = `INC-${String(inserted[0].number).padStart(4, "0")}`;

  // Gap-2 fix: email the tenant's CM(s) so they know the platform side has
  // opened an incident against their tenant. Fire-and-forget — never blocks
  // the response.
  const tenantSlug = scopeOrgSlug(scope);
  if (tenantSlug) {
    const subject = `${display} opened on ${tenantSlug} (${severity}) — ${title.slice(0, 80)}`;
    const text = [
      `A Sensussoft Super Admin has opened a platform incident scoped to your tenant.`,
      ``,
      `Incident: ${display}`,
      `Severity: ${severity}`,
      `Tenant scope: ${scope}`,
      `Opened at: ${inserted[0].openedAt.toISOString()}`,
      `Opened by: ${g.claims.email}`,
      ``,
      `Title:`,
      title,
      ``,
      `Sign in to the Compliance dashboard to coordinate response. The`,
      `incident will be marked resolved (with a public resolutionNote) when`,
      `the platform side closes it.`,
    ].join("\n");
    // Don't await — keep the POST snappy. emailTenantComplianceManagers
    // already swallows errors so this is safe.
    void emailTenantComplianceManagers(tenantSlug, subject, text);
  }

  return NextResponse.json(
    {
      ok: true,
      incident: {
        id: inserted[0].id,
        display,
        title,
        severity,
        status: "open",
        scope,
        runbookUrl,
        source: "manual",
        openedAt: inserted[0].openedAt.toISOString(),
        resolvedAt: null,
        resolutionNote: null,
        context: "Manual",
      },
    },
    { status: 201 },
  );
}

interface PatchBody {
  id?: string;
  status?: string;
  resolutionNote?: string | null;
}

const STATUS_FLOW = new Set(["open", "investigating", "mitigating", "monitoring", "resolved"]);

export async function PATCH(req: Request) {
  const g = await requireSuperAdmin();
  if ("error" in g) return g.error;
  let body: PatchBody;
  try { body = (await req.json()) as PatchBody; } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const id = body.id?.trim() ?? "";
  if (!isDbUid(id)) return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  const status = (body.status ?? "").toLowerCase();
  if (!STATUS_FLOW.has(status)) return NextResponse.json({ ok: false, error: "Invalid status." }, { status: 400 });

  const note = body.resolutionNote?.trim() || null;
  const rows = await prisma.$queryRaw<
    { id: string; number: number; title: string; severity: string; scope: string | null; status: string; resolvedAt: Date | null }[]
  >`
    UPDATE incidents SET
      status = ${status},
      "resolvedAt" = CASE WHEN ${status} = 'resolved' THEN NOW() ELSE NULL END,
      "resolutionNote" = ${note},
      "updatedAt" = NOW()
    WHERE id = ${id}::uuid
    RETURNING id, number, title, severity, scope, status, "resolvedAt"
  `;
  if (rows.length === 0) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  const inc = rows[0];

  // Gap-2 fix: notify tenant CM(s) when the incident moves to 'resolved'.
  // Other transitions stay silent — too noisy to mail on every step.
  if (status === "resolved") {
    const tenantSlug = scopeOrgSlug(inc.scope);
    if (tenantSlug) {
      const display = `INC-${String(inc.number).padStart(4, "0")}`;
      const subject = `${display} resolved on ${tenantSlug}`;
      const text = [
        `A Sensussoft platform incident scoped to your tenant has been resolved.`,
        ``,
        `Incident: ${display}`,
        `Severity: ${inc.severity}`,
        `Tenant scope: ${inc.scope}`,
        `Resolved at: ${inc.resolvedAt ? new Date(inc.resolvedAt).toISOString() : "(now)"}`,
        `Resolved by: ${g.claims.email}`,
        ``,
        `Title:`,
        inc.title,
        ``,
        `Resolution note:`,
        note ?? "(none provided)",
      ].join("\n");
      void emailTenantComplianceManagers(tenantSlug, subject, text);
    }
  }

  return NextResponse.json({ ok: true, incident: inc });
}
