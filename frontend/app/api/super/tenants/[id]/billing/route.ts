import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SubRow {
  tierName: string; cycle: string; qty: number; status: string;
  amountCents: number; currency: string; cardBrand: string | null; cardLast4: string | null;
  currentPeriodStart: Date | null; currentPeriodEnd: Date | null;
}
interface InvRow {
  number: string; tierName: string; cycle: string; amountCents: number; currency: string;
  status: string; cardBrand: string | null; cardLast4: string | null;
  stripePaymentIntentId: string | null; billingName: string | null; billingEmail: string | null;
  periodStart: Date | null; periodEnd: Date | null; createdAt: Date;
}

/** Per-tenant billing for the Super Admin: subscription + invoice/payment history. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Super Admin")
    return NextResponse.json({ ok: false, error: "Forbidden — Super Admin only." }, { status: 403 });
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const [orgRows, subs, invs] = await Promise.all([
    prisma.$queryRaw<{ name: string; tier: string; status: string }[]>`
      SELECT name, tier::text AS tier, status::text AS status FROM organizations WHERE id = ${id}::uuid LIMIT 1
    `,
    prisma.$queryRaw<SubRow[]>`
      SELECT "tierName", cycle, qty, status, "amountCents", currency, "cardBrand", "cardLast4",
             "currentPeriodStart", "currentPeriodEnd"
      FROM tenant_subscriptions WHERE "organizationId" = ${id}::uuid LIMIT 1
    `,
    prisma.$queryRaw<InvRow[]>`
      SELECT number, "tierName", cycle, "amountCents", currency, status, "cardBrand", "cardLast4",
             "stripePaymentIntentId", "billingName", "billingEmail", "periodStart", "periodEnd", "createdAt"
      FROM tenant_invoices WHERE "organizationId" = ${id}::uuid
      ORDER BY "createdAt" DESC LIMIT 100
    `,
  ]);
  if (!orgRows[0]) return NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 });

  const s = subs[0];
  return NextResponse.json({
    ok: true,
    tenant: { name: orgRows[0].name, tier: orgRows[0].tier, status: orgRows[0].status },
    subscription: s
      ? {
          tierName: s.tierName, cycle: s.cycle, qty: s.qty, status: s.status,
          amountCents: s.amountCents, currency: s.currency, cardBrand: s.cardBrand, cardLast4: s.cardLast4,
          periodStart: s.currentPeriodStart ? s.currentPeriodStart.toISOString() : null,
          nextBilling: s.currentPeriodEnd ? s.currentPeriodEnd.toISOString() : null,
        }
      : null,
    invoices: invs.map((i) => ({
      number: i.number, tierName: i.tierName, cycle: i.cycle, amountCents: i.amountCents, currency: i.currency,
      status: i.status, cardBrand: i.cardBrand, cardLast4: i.cardLast4, transactionId: i.stripePaymentIntentId ?? "",
      billingName: i.billingName, billingEmail: i.billingEmail,
      periodStart: i.periodStart ? i.periodStart.toISOString() : null,
      periodEnd: i.periodEnd ? i.periodEnd.toISOString() : null,
      createdAt: i.createdAt.toISOString(),
    })),
  });
}
