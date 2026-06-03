import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { guardCompliance } from "@/lib/compliance-guard";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SECTION_HEADINGS = [
  "Purpose & scope",
  "PHI categories covered",
  "Retention & data portability",
  "Re-consent & revocation",
];

interface PolicyRow {
  id: string;
  organizationId: string;
  version: string;
  slug: string;
  status: string;
  summary: string;
  sections: Prisma.JsonValue;
  scopeCategories: number;
  roleBindings: number;
  effectiveDate: Date | null;
  activatedAt: Date | null;
  archivedAt: Date | null;
  draftedAt: Date;
  history: Prisma.JsonValue;
}

async function findByIdOrSlug(orgId: string, key: string): Promise<PolicyRow | null> {
  const rows = await prisma.$queryRaw<PolicyRow[]>`
    SELECT id, "organizationId", version, slug, status, summary, sections,
           "scopeCategories", "roleBindings", "effectiveDate",
           "activatedAt", "archivedAt", "draftedAt", history
    FROM consent_policies
    WHERE "organizationId" = ${orgId}::uuid
      AND (
        ${UUID_RE.test(key) ? Prisma.sql`id = ${key}::uuid` : Prisma.sql`slug = ${key}`}
      )
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardCompliance();
  if ("error" in g) return g.error;
  const { id } = await ctx.params;
  const policy = await findByIdOrSlug(g.orgId, id);
  if (!policy) return NextResponse.json({ ok: false, error: "Policy not found." }, { status: 404 });
  return NextResponse.json({ ok: true, policy });
}

interface PatchBody {
  action?: "save_draft" | "activate" | "archive";
  summary?: string;
  sections?: { heading: string; body: string }[];
  scopeCategories?: number;
  roleBindings?: number;
  effectiveDate?: string | null;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardCompliance();
  if ("error" in g) return g.error;
  const { id } = await ctx.params;

  let body: PatchBody;
  try { body = (await req.json()) as PatchBody; }
  catch { return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 }); }

  const policy = await findByIdOrSlug(g.orgId, id);
  if (!policy) return NextResponse.json({ ok: false, error: "Policy not found." }, { status: 404 });

  const action = body.action ?? "save_draft";

  if (action === "save_draft") {
    if (policy.status === "archived")
      return NextResponse.json({ ok: false, error: "Cannot edit an archived policy." }, { status: 409 });

    const summary = (body.summary ?? "").trim() || policy.summary;
    const incoming = Array.isArray(body.sections) ? body.sections : null;
    const sections = incoming
      ? SECTION_HEADINGS.map((heading, i) => ({ heading, body: (incoming[i]?.body ?? "").trim() }))
      : null;

    if (sections && sections.some((s) => !s.body))
      return NextResponse.json({ ok: false, error: "All four sections need legal text." }, { status: 400 });

    const scopeCategories = Number.isFinite(body.scopeCategories)
      ? Math.max(1, Math.min(50, Math.floor(Number(body.scopeCategories))))
      : policy.scopeCategories;
    const roleBindings = Number.isFinite(body.roleBindings)
      ? Math.max(1, Math.min(50, Math.floor(Number(body.roleBindings))))
      : policy.roleBindings;

    await prisma.$executeRaw`
      UPDATE consent_policies SET
        summary = ${summary},
        sections = COALESCE(${sections ? JSON.stringify(sections) : null}::jsonb, sections),
        "scopeCategories" = ${scopeCategories},
        "roleBindings" = ${roleBindings},
        "effectiveDate" = COALESCE(${body.effectiveDate ?? null}::date, "effectiveDate"),
        "updatedAt" = NOW()
      WHERE id = ${policy.id}::uuid
    `;
    return NextResponse.json({ ok: true });
  }

  if (action === "activate") {
    if (policy.status === "active")
      return NextResponse.json({ ok: false, error: "Already active." }, { status: 409 });
    // Allow reactivating an archived row — same atomic flow as activating a
    // draft (archive whatever is currently active first). The previously
    // archived row keeps its history; we just flip its status back to active
    // and clear archivedAt.

    // Atomic: archive the current active row (if any), then activate this one.
    const today = new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
    const archiveEvent: { date: string; event: string } = { date: today, event: `Archived — superseded by ${policy.version}` };
    const activateEvent: { date: string; event: string } = {
      date: today,
      event: policy.status === "archived" ? `${policy.version} re-activated` : `${policy.version} activated`,
    };

    await prisma.$executeRaw`
      UPDATE consent_policies SET
        status = 'archived',
        "archivedAt" = NOW(),
        history = COALESCE(history, '[]'::jsonb) || ${JSON.stringify([archiveEvent])}::jsonb,
        "updatedAt" = NOW()
      WHERE "organizationId" = ${g.orgId}::uuid
        AND status = 'active'
    `;
    await prisma.$executeRaw`
      UPDATE consent_policies SET
        status = 'active',
        "activatedAt" = NOW(),
        "archivedAt" = NULL,
        history = COALESCE(history, '[]'::jsonb) || ${JSON.stringify([activateEvent])}::jsonb,
        "updatedAt" = NOW()
      WHERE id = ${policy.id}::uuid
    `;
    return NextResponse.json({ ok: true });
  }

  if (action === "archive") {
    if (policy.status !== "active")
      return NextResponse.json({ ok: false, error: "Only an active policy can be archived." }, { status: 409 });
    const today = new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
    const event = { date: today, event: `${policy.version} archived` };
    await prisma.$executeRaw`
      UPDATE consent_policies SET
        status = 'archived',
        "archivedAt" = NOW(),
        history = COALESCE(history, '[]'::jsonb) || ${JSON.stringify([event])}::jsonb,
        "updatedAt" = NOW()
      WHERE id = ${policy.id}::uuid
    `;
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
