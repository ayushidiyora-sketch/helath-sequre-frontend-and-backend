import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/super/break-glass/[id]/tag-read
 *
 * Manually log a PHI-bearing read against an active break-glass session.
 * Body: { endpoint: string, queryParams?: string, recordCount: number }
 *
 * This is the operator-driven path. The production target is to wire
 * `lib/break-glass-audit.ts › tagBreakGlassRead` into every tenant-scoped
 * read handler so tagging is automatic. For the demo / unit-test surface,
 * the operator can also POST here directly after running an out-of-band
 * SQL query — the result is the same: one row in `break_glass_reads` that
 * shows up on the break-glass page and the linked incident's detail.
 */

interface Body {
  endpoint?: string;
  queryParams?: string | null;
  recordCount?: number;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  if (claims.role !== "Super Admin") {
    return NextResponse.json({ ok: false, error: "Forbidden — Super Admin only." }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!isDbUid(id)) {
    return NextResponse.json({ ok: false, error: "Invalid session id." }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const endpoint = (body.endpoint ?? "").trim();
  const queryParams = (body.queryParams ?? "").trim() || null;
  const recordCount = Number.isFinite(body.recordCount) ? Math.max(0, Math.floor(Number(body.recordCount))) : 0;

  if (!endpoint || endpoint.length > 240) {
    return NextResponse.json({ ok: false, error: "Endpoint required (max 240 chars)." }, { status: 400 });
  }

  try {
    const [session] = await prisma.$queryRaw<
      { id: string; status: string; operatorId: string; operatorEmail: string; targetOrgId: string; displayId: string }[]
    >`
      SELECT id, status, "operatorId", "operatorEmail", "targetOrgId", "displayId"
      FROM break_glass_sessions WHERE id = ${id}::uuid LIMIT 1
    `;
    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }
    if (session.status !== "active") {
      return NextResponse.json(
        { ok: false, error: `Session is ${session.status} — cannot tag new reads.` },
        { status: 409 },
      );
    }

    await prisma.$executeRaw`
      INSERT INTO break_glass_reads (
        "sessionId", "operatorId", "operatorEmail",
        "targetOrgId", endpoint, "queryParams", "recordCount", "readAt"
      ) VALUES (
        ${session.id}::uuid, ${session.operatorId}::uuid, ${session.operatorEmail},
        ${session.targetOrgId}::uuid, ${endpoint}, ${queryParams}, ${recordCount}, NOW()
      )
    `;

    return NextResponse.json({ ok: true, displayId: session.displayId });
  } catch (err) {
    console.error("[break-glass tag-read] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
