import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/admin/templates/[id]/restore
 *
 * Restore an archived version. The [id] identifies the OLD row (any version
 * with `isActive = false`). We copy its subject / body / channels / smsLimit
 * into a brand-new row at `version = current_max + 1` with `isActive = true`,
 * and demote whatever was active.
 *
 * Returns: { ok, id: <new row id>, version: <new version> }
 */

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

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireOrgAdminCtx();
  if ("error" in g) return g.error;

  const { id } = await ctx.params;
  if (!isDbUid(id)) {
    return NextResponse.json({ ok: false, error: "Invalid template id." }, { status: 400 });
  }

  try {
    const [archived] = await prisma.$queryRaw<
      {
        id: string;
        organizationId: string;
        orgSlug: string | null;
        slug: string;
        name: string;
        channels: string[];
        subject: string | null;
        body: string;
        smsLimit: number | null;
      }[]
    >`
      SELECT t.id, t."organizationId", t.slug, t.name, t.channels,
             t.subject, t.body, t."smsLimit", o.slug AS "orgSlug"
      FROM notification_templates t
      LEFT JOIN organizations o ON o.id = t."organizationId"
      WHERE t.id = ${id}::uuid
      LIMIT 1
    `;
    if (!archived) {
      return NextResponse.json({ ok: false, error: "Template not found." }, { status: 404 });
    }
    if (archived.orgSlug !== g.claims.org) {
      return NextResponse.json(
        { ok: false, error: "Forbidden — template belongs to another tenant." },
        { status: 403 },
      );
    }

    const [{ maxv }] = await prisma.$queryRaw<{ maxv: number }[]>`
      SELECT COALESCE(MAX(version), 0)::int AS maxv
      FROM notification_templates
      WHERE "organizationId" = ${archived.organizationId}::uuid AND slug = ${archived.slug}
    `;
    const newVersion = (maxv ?? 0) + 1;
    const createdById = isDbUid(g.claims.uid) ? g.claims.uid : null;

    await prisma.$executeRaw`
      UPDATE notification_templates
      SET "isActive" = false, "updatedAt" = NOW()
      WHERE "organizationId" = ${archived.organizationId}::uuid
        AND slug = ${archived.slug}
        AND "isActive" = true
    `;
    const [inserted] = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO notification_templates (
        "organizationId", slug, name, channels, subject, body,
        version, "isActive", "smsLimit",
        "createdById", "createdByEmail", "createdAt", "updatedAt"
      ) VALUES (
        ${archived.organizationId}::uuid, ${archived.slug}, ${archived.name},
        ${archived.channels}::text[], ${archived.subject}, ${archived.body},
        ${newVersion}, true, ${archived.smsLimit},
        ${createdById}::uuid, ${g.claims.email}, NOW(), NOW()
      )
      RETURNING id
    `;
    return NextResponse.json({ ok: true, id: inserted.id, version: newVersion });
  } catch (err) {
    console.error("[templates restore] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
