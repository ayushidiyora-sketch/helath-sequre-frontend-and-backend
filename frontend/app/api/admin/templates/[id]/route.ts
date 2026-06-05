import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * PATCH /api/admin/templates/[id]
 *
 * Save-as-new-version. The [id] identifies the CURRENT active row. We:
 *   1. Verify tenant ownership.
 *   2. Flip the current row's `isActive` to false (still kept for audit).
 *   3. Insert a brand-new row with the same slug / name / channels / smsLimit,
 *      `version = current.version + 1`, the new subject / body from the body,
 *      and `isActive = true`.
 *
 * Body: { subject?: string, body: string }
 * Returns: { ok, id: <new row id>, version: <new version> }
 */

interface Body {
  subject?: string | null;
  body?: string;
}

async function requireOrgAdminCtx() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) {
    return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) };
  }
  if (claims.role !== "Org Admin") {
    return {
      error: NextResponse.json({ ok: false, error: "Forbidden — Org Admin only." }, { status: 403 }),
    };
  }
  if (!claims.org) {
    return { error: NextResponse.json({ ok: false, error: "No tenant on session" }, { status: 400 }) };
  }
  return { claims };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireOrgAdminCtx();
  if ("error" in g) return g.error;

  const { id } = await ctx.params;
  if (!isDbUid(id)) {
    return NextResponse.json({ ok: false, error: "Invalid template id." }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const subject = body.subject == null ? null : String(body.subject).trim() || null;
  const newBody = String(body.body ?? "").trim();
  if (!newBody) {
    return NextResponse.json({ ok: false, error: "Body is required." }, { status: 400 });
  }
  if (newBody.length > 8000) {
    return NextResponse.json({ ok: false, error: "Body too long (max 8000 chars)." }, { status: 400 });
  }

  try {
    // Resolve tenant + current row in one round-trip.
    const [current] = await prisma.$queryRaw<
      {
        id: string;
        organizationId: string;
        orgSlug: string | null;
        slug: string;
        name: string;
        channels: string[];
        version: number;
        smsLimit: number | null;
        isActive: boolean;
      }[]
    >`
      SELECT t.id, t."organizationId", t.slug, t.name, t.channels, t.version,
             t."smsLimit", t."isActive", o.slug AS "orgSlug"
      FROM notification_templates t
      LEFT JOIN organizations o ON o.id = t."organizationId"
      WHERE t.id = ${id}::uuid
      LIMIT 1
    `;
    if (!current) {
      return NextResponse.json({ ok: false, error: "Template not found." }, { status: 404 });
    }
    if (current.orgSlug !== g.claims.org) {
      return NextResponse.json(
        { ok: false, error: "Forbidden — template belongs to another tenant." },
        { status: 403 },
      );
    }

    // Find the highest existing version for this slug so version numbering
    // always advances even if the [id] row isn't the latest (e.g. someone
    // restored an old version recently).
    const [{ maxv }] = await prisma.$queryRaw<{ maxv: number }[]>`
      SELECT COALESCE(MAX(version), 0)::int AS maxv
      FROM notification_templates
      WHERE "organizationId" = ${current.organizationId}::uuid AND slug = ${current.slug}
    `;
    const newVersion = (maxv ?? current.version) + 1;

    const createdById = isDbUid(g.claims.uid) ? g.claims.uid : null;

    // Demote every active row for this slug, then INSERT the new active row.
    // Two-step instead of a CTE because Prisma's $executeRaw can't return
    // multiple rows from a CTE in this codebase reliably.
    await prisma.$executeRaw`
      UPDATE notification_templates
      SET "isActive" = false, "updatedAt" = NOW()
      WHERE "organizationId" = ${current.organizationId}::uuid
        AND slug = ${current.slug}
        AND "isActive" = true
    `;
    const [inserted] = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO notification_templates (
        "organizationId", slug, name, channels, subject, body,
        version, "isActive", "smsLimit",
        "createdById", "createdByEmail", "createdAt", "updatedAt"
      ) VALUES (
        ${current.organizationId}::uuid, ${current.slug}, ${current.name},
        ${current.channels}::text[], ${subject}, ${newBody},
        ${newVersion}, true, ${current.smsLimit},
        ${createdById}::uuid, ${g.claims.email}, NOW(), NOW()
      )
      RETURNING id
    `;
    return NextResponse.json({ ok: true, id: inserted.id, version: newVersion });
  } catch (err) {
    console.error("[templates PATCH] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
