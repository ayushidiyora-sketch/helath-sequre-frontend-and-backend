import { NextResponse } from "next/server";
import { getStripe, appBaseUrl } from "@/lib/stripe";
import { getTiers } from "@/lib/tiers";

export const runtime = "nodejs";

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
 * Create a Stripe Checkout Session for a subscription tier. Prices are recomputed
 * server-side from `subscription_tiers` (never trust the client amount), so the
 * charge always matches the live tier price. Returns the hosted checkout URL.
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
  const subtotal = unit * qty * months; // whole-dollar unit prices
  const subtotalCents = Math.round(subtotal * 100);
  const taxCents = Math.round(subtotal * TAX_RATE * 100);

  const base = appBaseUrl();
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: subtotalCents,
            product_data: {
              name: `${tier.name} — ${cycle === "annual" ? "Annual" : "Monthly"}`,
              description: `${qty.toLocaleString()} × ${tier.unit}`,
            },
          },
        },
        ...(taxCents > 0
          ? [{
              quantity: 1,
              price_data: {
                currency: "usd" as const,
                unit_amount: taxCents,
                product_data: { name: `Tax (GST/VAT ${Math.round(TAX_RATE * 100)}%)` },
              },
            }]
          : []),
      ],
      metadata: {
        tierId: tier.id,
        tierName: tier.name,
        cycle,
        qty: String(qty),
        orgName: (body.orgName ?? "").slice(0, 200),
        fullName: (body.fullName ?? "").slice(0, 200),
        country: (body.country ?? "").slice(0, 80),
        taxId: (body.taxId ?? "").slice(0, 60),
      },
      success_url: `${base}/checkout/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/checkout?tier=${tier.id}`,
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
