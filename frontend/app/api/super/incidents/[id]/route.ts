import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/super/incidents/[id]
 *
 * Returns one incident + every cross-module row that linked to it:
 *   - break-glass sessions whose `incidentRef` matches `INC-NNNN`
 *   - anomaly_decisions whose `coordinatedWith` mentions `INC-NNNN`
 *     (this is the back-link written by the anomalies PATCH auto-incident path)
 *
 * Super Admin only.
 */

async function requireSuperAdmin() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims || claims.role !== "Super Admin") {
    return {
      error: NextResponse.json(
        { ok: false, error: "Forbidden — Super Admin only." },
        { status: 403 },
      ),
    } as const;
  }
  return { claims } as const;
}

interface IncidentRow {
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
  openedByEmail: string | null;
}

interface ReadRow {
  id: string;
  sessionDisplay: string;
  operatorEmail: string;
  endpoint: string;
  queryParams: string | null;
  recordCount: number;
  readAt: Date;
}

interface BgRow {
  id: string;
  displayId: string;
  operatorEmail: string;
  targetOrgSlug: string | null;
  justification: string;
  status: string;
  startedAt: Date;
  closedAt: Date | null;
}

interface AnomalyRow {
  signature: string;
  status: string;
  outcome: string | null;
  decidedByEmail: string | null;
  decidedAt: Date | null;
  justification: string | null;
  coordinatedWith: string | null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireSuperAdmin();
  if ("error" in g) return g.error;

  const { id } = await ctx.params;
  if (!isDbUid(id)) {
    return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  }

  try {
    const [inc] = await prisma.$queryRaw<IncidentRow[]>`
      SELECT i.id, i.number, i.title, i.severity, i.status, i.scope, i."runbookUrl",
             i."openedAt", i."resolvedAt", i."resolutionNote",
             u.email AS "openedByEmail"
      FROM incidents i
      LEFT JOIN users u ON u.id = i."openedBy"
      WHERE i.id = ${id}::uuid
      LIMIT 1
    `;
    if (!inc) {
      return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    }
    const display = `INC-${String(inc.number).padStart(4, "0")}`;

    const breakGlass = await prisma.$queryRaw<BgRow[]>`
      SELECT b.id, b."displayId", b."operatorEmail",
             o.slug AS "targetOrgSlug", b.justification, b.status,
             b."startedAt", b."closedAt"
      FROM break_glass_sessions b
      LEFT JOIN organizations o ON o.id = b."targetOrgId"
      WHERE b."incidentRef" = ${display}
      ORDER BY b."startedAt" DESC
    `;

    const anomalies = await prisma.$queryRaw<AnomalyRow[]>`
      SELECT signature, status, outcome, "decidedByEmail", "decidedAt",
             justification, "coordinatedWith"
      FROM anomaly_decisions
      WHERE "coordinatedWith" LIKE ${"%" + display + "%"}
      ORDER BY "decidedAt" DESC NULLS LAST
    `;

    // PHI reads tagged with break_glass=true that took place inside any
    // session whose incidentRef matches this INC. Joined to break-glass for
    // the displayId; if a row has no parent session it can't surface here.
    const reads = await prisma.$queryRaw<ReadRow[]>`
      SELECT r.id, b."displayId" AS "sessionDisplay",
             r."operatorEmail", r.endpoint, r."queryParams", r."recordCount", r."readAt"
      FROM break_glass_reads r
      JOIN break_glass_sessions b ON b.id = r."sessionId"
      WHERE b."incidentRef" = ${display}
      ORDER BY r."readAt" DESC
      LIMIT 100
    `;

    return NextResponse.json({
      ok: true,
      incident: {
        id: inc.id,
        display,
        title: inc.title,
        severity: inc.severity,
        status: inc.status,
        scope: inc.scope,
        runbookUrl: inc.runbookUrl,
        openedAt: inc.openedAt.toISOString(),
        resolvedAt: inc.resolvedAt ? inc.resolvedAt.toISOString() : null,
        resolutionNote: inc.resolutionNote,
        openedByEmail: inc.openedByEmail,
      },
      reads: reads.map((r) => ({
        id: r.id,
        sessionDisplay: r.sessionDisplay,
        operatorEmail: r.operatorEmail,
        endpoint: r.endpoint,
        queryParams: r.queryParams,
        recordCount: r.recordCount,
        readAt: r.readAt.toISOString(),
      })),
      breakGlass: breakGlass.map((b) => ({
        id: b.id,
        displayId: b.displayId,
        operatorEmail: b.operatorEmail,
        targetOrgSlug: b.targetOrgSlug,
        justification: b.justification,
        status: b.status,
        startedAt: b.startedAt.toISOString(),
        closedAt: b.closedAt ? b.closedAt.toISOString() : null,
      })),
      anomalies: anomalies.map((a) => ({
        signature: a.signature,
        status: a.status,
        outcome: a.outcome,
        decidedByEmail: a.decidedByEmail,
        decidedAt: a.decidedAt ? a.decidedAt.toISOString() : null,
        justification: a.justification,
        coordinatedWith: a.coordinatedWith,
      })),
    });
  } catch (err) {
    console.error("[incidents detail] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
