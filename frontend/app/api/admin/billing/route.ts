import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Org-Admin billing — the tenant's current subscription + invoice history from
 * `tenant_subscriptions` / `tenant_invoices` (replaces the old hardcoded list).
 */
interface SubRow {
  tierName: string; cycle: string; qty: number; status: string;
  amountCents: number; currency: string; cardBrand: string | null; cardLast4: string | null;
  currentPeriodEnd: Date | null;
}
interface InvRow {
  number: string; tierName: string; cycle: string; amountCents: number; currency: string;
  status: string; cardBrand: string | null; cardLast4: string | null;
  stripePaymentIntentId: string | null; billingName: string | null; billingEmail: string | null;
  periodStart: Date | null; periodEnd: Date | null; createdAt: Date;
}

export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Org Admin")
    return NextResponse.json({ ok: false, error: "Forbidden — Org Admin only." }, { status: 403 });
  if (!isDbUid(claims.uid)) return NextResponse.json({ ok: true, subscription: null, invoices: [] });

  const me = await prisma.$queryRaw<{ organizationId: string | null; email: string }[]>`
    SELECT "organizationId", email FROM users WHERE id = ${claims.uid}::uuid LIMIT 1
  `;
  const orgId = me[0]?.organizationId;
  if (!orgId) return NextResponse.json({ ok: true, subscription: null, invoices: [] });

  const [subs, invs] = await Promise.all([
    prisma.$queryRaw<SubRow[]>`
      SELECT "tierName", cycle, qty, status, "amountCents", currency, "cardBrand", "cardLast4", "currentPeriodEnd"
      FROM tenant_subscriptions WHERE "organizationId" = ${orgId}::uuid LIMIT 1
    `,
    prisma.$queryRaw<InvRow[]>`
      SELECT number, "tierName", cycle, "amountCents", currency, status, "cardBrand", "cardLast4",
             "stripePaymentIntentId", "billingName", "billingEmail", "periodStart", "periodEnd", "createdAt"
      FROM tenant_invoices WHERE "organizationId" = ${orgId}::uuid
      ORDER BY "createdAt" DESC LIMIT 100
    `,
  ]);

  const s = subs[0];
  return NextResponse.json({
    ok: true,
    billingEmail: me[0]?.email ?? null,
    subscription: s
      ? {
          tierName: s.tierName, cycle: s.cycle, qty: s.qty, status: s.status,
          amountCents: s.amountCents, currency: s.currency,
          cardBrand: s.cardBrand, cardLast4: s.cardLast4,
          nextBilling: s.currentPeriodEnd ? s.currentPeriodEnd.toISOString() : null,
        }
      : null,
    invoices: invs.map((i) => ({
      number: i.number, tierName: i.tierName, cycle: i.cycle,
      amountCents: i.amountCents, currency: i.currency, status: i.status,
      cardBrand: i.cardBrand, cardLast4: i.cardLast4, transactionId: i.stripePaymentIntentId ?? "",
      billingName: i.billingName, billingEmail: i.billingEmail,
      periodStart: i.periodStart ? i.periodStart.toISOString() : null,
      periodEnd: i.periodEnd ? i.periodEnd.toISOString() : null,
      createdAt: i.createdAt.toISOString(),
    })),
  });
}
