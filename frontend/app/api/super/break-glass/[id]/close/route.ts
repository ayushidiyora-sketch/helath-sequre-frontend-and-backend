import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/super/break-glass/[id]/close
 *
 * Close an active break-glass session early. Only the session's own operator
 * (or any Super Admin — for the tenant-CM override flow) can call this.
 * Sets status='closed', closedAt=NOW(), closeReason='manual'.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  if (claims.role !== "Super Admin") {
    return NextResponse.json({ ok: false, error: "Forbidden — Super Admin only." }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ ok: false, error: "Invalid session id." }, { status: 400 });
  }

  try {
    const [existing] = await prisma.$queryRaw<
      { id: string; status: string; operatorId: string; displayId: string }[]
    >`
      SELECT id, status, "operatorId", "displayId"
      FROM break_glass_sessions
      WHERE id = ${id}::uuid
      LIMIT 1
    `;
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }
    if (existing.status !== "active") {
      return NextResponse.json(
        { ok: false, error: `Session is already ${existing.status}.` },
        { status: 409 },
      );
    }

    await prisma.$executeRaw`
      UPDATE break_glass_sessions
      SET status = 'closed', "closedAt" = NOW(), "closeReason" = 'manual', "updatedAt" = NOW()
      WHERE id = ${id}::uuid
    `;

    return NextResponse.json({ ok: true, displayId: existing.displayId });
  } catch (err) {
    console.error("[break-glass close] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
