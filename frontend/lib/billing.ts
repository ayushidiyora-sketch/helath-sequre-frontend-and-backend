import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

/**
 * Post-payment persistence + tenant activation (finalize-on-return). After
 * Stripe confirms a PaymentIntent, the thank-you page calls finalizePayment()
 * which re-verifies the PI server-side and — idempotently — records the
 * subscription + invoice and flips the org to active. No webhook required.
 */

export interface InvoiceView {
  number: string | null;
  tierName: string;
  cycle: string;
  qty: number;
  amountCents: number;
  currency: string;
  cardBrand: string | null;
  cardLast4: string | null;
  transactionId: string;
  billingName: string | null;
  billingEmail: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface FinalizeResult {
  ok: boolean;
  paid: boolean;
  persisted: boolean;
  invoice: InvoiceView | null;
}

/** solo|hospital|enterprise → the org's TenantTier enum (basic|pro|enterprise). */
function mapTier(tierId: string): "basic" | "pro" | "enterprise" {
  if (tierId === "hospital") return "pro";
  if (tierId === "enterprise") return "enterprise";
  return "basic";
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

interface InvoiceRow {
  number: string;
  tierName: string;
  cycle: string;
  qty: number;
  amountCents: number;
  currency: string;
  cardBrand: string | null;
  cardLast4: string | null;
  stripePaymentIntentId: string | null;
  billingName: string | null;
  billingEmail: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
}

function toView(r: InvoiceRow): InvoiceView {
  return {
    number: r.number,
    tierName: r.tierName,
    cycle: r.cycle,
    qty: r.qty,
    amountCents: r.amountCents,
    currency: r.currency,
    cardBrand: r.cardBrand,
    cardLast4: r.cardLast4,
    transactionId: r.stripePaymentIntentId ?? "",
    billingName: r.billingName,
    billingEmail: r.billingEmail,
    periodStart: r.periodStart ? r.periodStart.toISOString() : null,
    periodEnd: r.periodEnd ? r.periodEnd.toISOString() : null,
  };
}

export async function finalizePayment(paymentIntentId: string): Promise<FinalizeResult> {
  const stripe = getStripe();
  if (!stripe || !paymentIntentId) return { ok: false, paid: false, persisted: false, invoice: null };

  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge.payment_method_details"] });
  } catch {
    return { ok: false, paid: false, persisted: false, invoice: null };
  }
  const paid = pi.status === "succeeded";

  // Already recorded? Return the stored invoice (idempotent).
  const existing = await prisma.$queryRaw<InvoiceRow[]>`
    SELECT number, "tierName", cycle, qty, "amountCents", currency, "cardBrand", "cardLast4",
           "stripePaymentIntentId", "billingName", "billingEmail", "periodStart", "periodEnd"
    FROM tenant_invoices WHERE "stripePaymentIntentId" = ${pi.id} LIMIT 1
  `;
  if (existing[0]) return { ok: true, paid, persisted: true, invoice: toView(existing[0]) };

  const m = pi.metadata ?? {};
  const orgId = m.organizationId && /^[0-9a-f-]{36}$/i.test(m.organizationId) ? m.organizationId : null;
  const tierId = m.tierId ?? "solo";
  const tierName = m.tierName ?? "Subscription";
  const cycle = m.cycle === "monthly" ? "monthly" : "annual";
  const qty = Math.max(1, Math.floor(Number(m.qty) || 1));
  const amountCents = pi.amount ?? 0;
  const currency = pi.currency ?? "usd";

  // Card brand + last4 from the charge's payment method details.
  let cardBrand: string | null = null;
  let cardLast4: string | null = null;
  const charge = pi.latest_charge as Stripe.Charge | null;
  const card = charge?.payment_method_details?.card;
  if (card) { cardBrand = card.brand ?? null; cardLast4 = card.last4 ?? null; }

  const billingName = m.fullName || (charge?.billing_details?.name ?? null);
  const billingEmail = pi.receipt_email || (charge?.billing_details?.email ?? null);

  // Without an org we can't activate a tenant — return a non-persisted view so
  // the thank-you page still shows the receipt.
  if (!orgId || !paid) {
    return {
      ok: true, paid, persisted: false,
      invoice: {
        number: null, tierName, cycle, qty, amountCents, currency, cardBrand, cardLast4,
        transactionId: pi.id, billingName, billingEmail, periodStart: null, periodEnd: null,
      },
    };
  }

  const start = new Date();
  const end = addMonths(start, cycle === "annual" ? 12 : 1);

  // Subscription (one current row per org).
  await prisma.$executeRaw`
    INSERT INTO tenant_subscriptions
      (id, "organizationId", "tierId", "tierName", cycle, qty, status, "amountCents", currency,
       "cardBrand", "cardLast4", "stripePaymentIntentId", "currentPeriodStart", "currentPeriodEnd", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), ${orgId}::uuid, ${tierId}, ${tierName}, ${cycle}, ${qty}, 'active', ${amountCents}, ${currency},
       ${cardBrand}, ${cardLast4}, ${pi.id}, ${start}, ${end}, NOW(), NOW())
    ON CONFLICT ("organizationId") DO UPDATE SET
      "tierId" = EXCLUDED."tierId", "tierName" = EXCLUDED."tierName", cycle = EXCLUDED.cycle, qty = EXCLUDED.qty,
      status = 'active', "amountCents" = EXCLUDED."amountCents", currency = EXCLUDED.currency,
      "cardBrand" = EXCLUDED."cardBrand", "cardLast4" = EXCLUDED."cardLast4",
      "stripePaymentIntentId" = EXCLUDED."stripePaymentIntentId",
      "currentPeriodStart" = EXCLUDED."currentPeriodStart", "currentPeriodEnd" = EXCLUDED."currentPeriodEnd",
      "updatedAt" = NOW()
  `;

  // Activate the tenant (status + mapped tier enum).
  await prisma.$executeRaw`
    UPDATE organizations SET status = 'active'::"TenantStatus", tier = ${mapTier(tierId)}::"TenantTier", "updatedAt" = NOW()
    WHERE id = ${orgId}::uuid
  `;

  // Invoice (history) with a generated number.
  const year = start.getUTCFullYear();
  const cnt = await prisma.$queryRaw<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM tenant_invoices WHERE number LIKE ${`INV-${year}-%`}
  `;
  const number = `INV-${year}-${String((cnt[0]?.c ?? 0) + 1).padStart(4, "0")}`;

  await prisma.$executeRaw`
    INSERT INTO tenant_invoices
      (id, "organizationId", number, "tierName", cycle, qty, "amountCents", currency, status,
       "cardBrand", "cardLast4", "stripePaymentIntentId", "billingName", "billingEmail",
       "periodStart", "periodEnd", "createdAt")
    VALUES
      (gen_random_uuid(), ${orgId}::uuid, ${number}, ${tierName}, ${cycle}, ${qty}, ${amountCents}, ${currency}, 'paid',
       ${cardBrand}, ${cardLast4}, ${pi.id}, ${billingName}, ${billingEmail}, ${start}, ${end}, NOW())
    ON CONFLICT ("stripePaymentIntentId") DO NOTHING
  `;

  return {
    ok: true, paid: true, persisted: true,
    invoice: {
      number, tierName, cycle, qty, amountCents, currency, cardBrand, cardLast4,
      transactionId: pi.id, billingName, billingEmail,
      periodStart: start.toISOString(), periodEnd: end.toISOString(),
    },
  };
}

/** Whether an org currently has an active subscription (used for the onboarding redirect). */
export async function orgHasActiveSubscription(orgId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM tenant_subscriptions WHERE "organizationId" = ${orgId}::uuid AND status = 'active'
  `;
  return (rows[0]?.c ?? 0) > 0;
}
