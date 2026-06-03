import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Patient-side re-consent endpoint. The clinician triggers a campaign on
 * /compliance/consent-policies → that inserts a pending row in
 * `re_consent_responses` for every patient who's still on a prior policy
 * version. This endpoint lets the patient view the new policy + its sections
 * (joined from `consent_policies`) and approve/decline. Approving migrates
 * their active consents to the new policy version metadata; declining
 * records the refusal so Compliance can follow up.
 */

interface SectionRow { heading: string; body: string }

function readSections(raw: Prisma.JsonValue): SectionRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is { heading: string; body: string } =>
      !!s && typeof s === "object" &&
      typeof (s as { heading?: unknown }).heading === "string" &&
      typeof (s as { body?: unknown }).body === "string",
  );
}

async function guard(): Promise<
  | { error: NextResponse; uid?: never }
  | { error?: never; uid: string; email: string }
> {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims)
    return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) };
  if (claims.role !== "Patient")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 }) };
  if (!isDbUid(claims.uid))
    return { error: NextResponse.json({ ok: true, pending: [] }) };
  return { uid: claims.uid, email: claims.email ?? "" };
}

export async function GET() {
  const g = await guard();
  if ("error" in g) return g.error;

  const rows = await prisma.$queryRaw<{
    responseId: string;
    campaignId: string;
    policyId: string;
    policyVersion: string;
    activatedAt: Date | null;
    summary: string;
    sections: Prisma.JsonValue;
    createdAt: Date;
  }[]>`
    SELECT rcr.id           AS "responseId",
           rcr."campaignId",
           rcr."policyId",
           rcr."policyVersion",
           cp."activatedAt",
           cp.summary,
           cp.sections,
           rcr."createdAt"
    FROM re_consent_responses rcr
    JOIN consent_policies cp ON cp.id = rcr."policyId"
    WHERE rcr."patientId" = ${g.uid}::uuid
      AND rcr.response = 'pending'
    ORDER BY rcr."createdAt" DESC
  `;

  return NextResponse.json({
    ok: true,
    pending: rows.map((r) => ({
      responseId: r.responseId,
      campaignId: r.campaignId,
      policyId: r.policyId,
      policyVersion: r.policyVersion,
      activatedAt: r.activatedAt ? r.activatedAt.toISOString() : null,
      summary: r.summary,
      sections: readSections(r.sections),
      issuedAt: r.createdAt.toISOString(),
    })),
  });
}

interface PatchBody {
  responseId?: string;
  decision?: "approved" | "declined";
  note?: string;
}

export async function PATCH(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;

  let body: PatchBody;
  try { body = (await req.json()) as PatchBody; }
  catch { return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 }); }

  const id = (body.responseId ?? "").trim();
  if (!UUID_RE.test(id))
    return NextResponse.json({ ok: false, error: "Valid responseId required." }, { status: 400 });
  if (body.decision !== "approved" && body.decision !== "declined")
    return NextResponse.json({ ok: false, error: "decision must be approved or declined" }, { status: 400 });

  // Ownership check — patient can only respond to their own pending row.
  const owned = await prisma.$queryRaw<{
    id: string; response: string; patientId: string; organizationId: string;
    policyVersion: string;
  }[]>`
    SELECT id, response, "patientId"::text AS "patientId",
           "organizationId"::text AS "organizationId", "policyVersion"
    FROM re_consent_responses
    WHERE id = ${id}::uuid LIMIT 1
  `;
  const row = owned[0];
  if (!row || row.patientId !== g.uid)
    return NextResponse.json({ ok: false, error: "Response not found." }, { status: 404 });
  if (row.response !== "pending")
    return NextResponse.json({ ok: false, error: `Already ${row.response}.` }, { status: 409 });

  await prisma.$executeRaw`
    UPDATE re_consent_responses SET
      response       = ${body.decision},
      "respondedAt"  = NOW(),
      "decisionNote" = ${body.note?.toString().trim() || null},
      "updatedAt"    = NOW()
    WHERE id = ${id}::uuid
  `;

  return NextResponse.json({ ok: true });
}
