import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardCompliance } from "@/lib/compliance-guard";

export const runtime = "nodejs";

/**
 * PATCH /api/compliance/retention/overrides
 * Compliance Manager toggles `pausePurge` / `legalHold` on the tenant's
 * override row. Every change writes the actor email + reason + ISO timestamp
 * so the amber "Last override" banner on the page is honest.
 */

interface Body {
  pausePurge?: boolean;
  legalHold?: boolean;
  reason?: string;
  incidentRef?: string;
}

export async function PATCH(req: Request) {
  const g = await guardCompliance();
  if ("error" in g) return g.error;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  if (typeof body.pausePurge !== "boolean" && typeof body.legalHold !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "Provide pausePurge or legalHold." },
      { status: 400 },
    );
  }

  const reason = (body.reason ?? "").trim().slice(0, 280) || null;
  const incidentRef = (body.incidentRef ?? "").trim().slice(0, 32) || null;

  const me = await prisma.$queryRaw<{ email: string }[]>`
    SELECT email FROM users WHERE id = ${g.uid}::uuid LIMIT 1
  `;
  const actorEmail = me[0]?.email ?? null;

  // Ensure a row exists, then update only the provided fields. We rebuild the
  // last-changed metadata on every PATCH so the amber banner always reflects
  // the most recent toggle.
  await prisma.$executeRaw`
    INSERT INTO retention_overrides ("organizationId", "pausePurge", "legalHold")
    VALUES (${g.orgId}::uuid, false, true)
    ON CONFLICT ("organizationId") DO NOTHING
  `;

  // Build a single UPDATE with COALESCE so partial bodies don't clobber the
  // other field.
  await prisma.$executeRaw`
    UPDATE retention_overrides
    SET "pausePurge" = COALESCE(${body.pausePurge ?? null}::boolean, "pausePurge"),
        "legalHold" = COALESCE(${body.legalHold ?? null}::boolean, "legalHold"),
        "lastChangedAt" = NOW(),
        "lastChangedById" = ${g.uid}::uuid,
        "lastChangedByEmail" = ${actorEmail},
        "lastChangeReason" = ${reason},
        "lastChangeIncidentRef" = ${incidentRef},
        "updatedAt" = NOW()
    WHERE "organizationId" = ${g.orgId}::uuid
  `;

  return NextResponse.json({ ok: true });
}
