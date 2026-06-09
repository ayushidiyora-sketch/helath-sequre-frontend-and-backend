import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Cross-tenant billing overview for the Super Admin — every tenant with its
 * current subscription + invoice rollup (last payment, total collected). Powers
 * /super/billing. Joins organizations ← tenant_subscriptions + an invoice
 * lateral aggregate.
 */
interface Row {
  id: string;
  name: string;
  type: string;
  tier: string;
  status: string;
  tierName: string | null;
  cycle: string | null;
  subStatus: string | null;
  amountCents: number | null;
  cardBrand: string | null;
  cardLast4: string | null;
  nextBilling: Date | null;
  invCount: number;
  totalCents: number;
  lastAt: Date | null;
  lastNumber: string | null;
  lastAmount: number | null;
}

export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Super Admin")
    return NextResponse.json({ ok: false, error: "Forbidden — Super Admin only." }, { status: 403 });

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT o.id::text AS id, o.name, o.type::text AS type, o.tier::text AS tier, o.status::text AS status,
           s."tierName", s.cycle, s.status AS "subStatus", s."amountCents", s."cardBrand", s."cardLast4",
           s."currentPeriodEnd" AS "nextBilling",
           COALESCE(inv.n, 0) AS "invCount", COALESCE(inv.total, 0) AS "totalCents",
           inv.last_at AS "lastAt", inv.last_number AS "lastNumber", inv.last_amount AS "lastAmount"
    FROM organizations o
    LEFT JOIN tenant_subscriptions s ON s."organizationId" = o.id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS n,
             COALESCE(SUM("amountCents"), 0)::int AS total,
             MAX("createdAt") AS last_at,
             (ARRAY_AGG(number ORDER BY "createdAt" DESC))[1] AS last_number,
             (ARRAY_AGG("amountCents" ORDER BY "createdAt" DESC))[1] AS last_amount
      FROM tenant_invoices WHERE "organizationId" = o.id
    ) inv ON TRUE
    ORDER BY (s.status = 'active') DESC NULLS LAST, o.name ASC
  `;

  const tenants = rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    tier: r.tier,
    status: r.status,
    subscription: r.tierName
      ? {
          tierName: r.tierName, cycle: r.cycle, status: r.subStatus,
          amountCents: r.amountCents ?? 0, cardBrand: r.cardBrand, cardLast4: r.cardLast4,
          nextBilling: r.nextBilling ? r.nextBilling.toISOString() : null,
        }
      : null,
    invoiceCount: Number(r.invCount ?? 0),
    totalCents: Number(r.totalCents ?? 0),
    lastPaymentAt: r.lastAt ? r.lastAt.toISOString() : null,
    lastInvoiceNumber: r.lastNumber,
    lastAmountCents: r.lastAmount != null ? Number(r.lastAmount) : null,
  }));

  const activeSubs = tenants.filter((t) => t.subscription?.status === "active").length;
  const collectedCents = tenants.reduce((s, t) => s + t.totalCents, 0);

  return NextResponse.json({
    ok: true,
    summary: { tenants: tenants.length, activeSubscriptions: activeSubs, collectedCents },
    tenants,
  });
}
