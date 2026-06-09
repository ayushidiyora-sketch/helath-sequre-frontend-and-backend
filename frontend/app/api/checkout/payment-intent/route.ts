import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { getTiers } from "@/lib/tiers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** Resolve the signed-in buyer's organization UUID (so the purchase activates
 *  their tenant). Null for signed-out prospects. claims.org is a slug, not the id. */
async function resolveOrgId(): Promise<string | null> {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims || !isDbUid(claims.uid)) return null;
  const rows = await prisma.$queryRaw<{ organizationId: string | null }[]>`
    SELECT "organizationId" FROM users WHERE id = ${claims.uid}::uuid LIMIT 1
  `;
  return rows[0]?.organizationId ?? null;
}

const TAX_RATE = 0.09;
const QTY_BOUNDS: Record<string, { min: number; max: number }> = {
  solo: { min: 1, max: 5 },
  hospital: { min: 100, max: 50_000 },
};

interface Body {
  tierId?: string;
  cycle?: "monthly" | "annual";
  qty?: number;
  fullName?: string;
  email?: string;
  orgName?: string;
  country?: string;
  taxId?: string;
}

/**
 * Create a PaymentIntent for an embedded (Payment Element) checkout. The amount
 * is recomputed server-side from `subscription_tiers` so the charge always
 * matches the live tier price regardless of what the client sends.
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ ok: false, error: "Payments are not configured." }, { status: 503 });

  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 }); }

  const cycle = body.cycle === "monthly" ? "monthly" : "annual";
  const tiers = await getTiers();
  const tier = tiers.find((t) => t.id === body.tierId);
  if (!tier) return NextResponse.json({ ok: false, error: "Unknown tier." }, { status: 400 });
  if (tier.monthly === null) return NextResponse.json({ ok: false, error: "This tier is custom-priced — contact sales." }, { status: 400 });
  const email = (body.email ?? "").trim();
  if (!/\S+@\S+\.\S+/.test(email)) return NextResponse.json({ ok: false, error: "A valid billing email is required." }, { status: 400 });

  const bounds = QTY_BOUNDS[tier.id] ?? { min: 1, max: 100_000 };
  const qty = Math.max(bounds.min, Math.min(bounds.max, Math.floor(Number(body.qty) || bounds.min)));
  const unit = cycle === "annual" ? (tier.annualMonthly ?? tier.monthly) : tier.monthly;
  const months = cycle === "annual" ? 12 : 1;
  const subtotal = unit * qty * months;
  const total = subtotal + subtotal * TAX_RATE;
  const amount = Math.round(total * 100); // cents

  const organizationId = await resolveOrgId();

  try {
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      // Lets the Payment Element offer cards (+ other enabled methods).
      automatic_payment_methods: { enabled: true },
      receipt_email: email,
      description: `${tier.name} — ${cycle === "annual" ? "Annual" : "Monthly"} · ${qty.toLocaleString()} × ${tier.unit}`,
      metadata: {
        tierId: tier.id,
        tierName: tier.name,
        cycle,
        qty: String(qty),
        organizationId: organizationId ?? "",
        orgName: (body.orgName ?? "").slice(0, 200),
        fullName: (body.fullName ?? "").slice(0, 200),
        country: (body.country ?? "").slice(0, 80),
        taxId: (body.taxId ?? "").slice(0, 60),
      },
    });
    return NextResponse.json({ ok: true, clientSecret: intent.client_secret, amount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
