import Stripe from "stripe";

/**
 * Server-side Stripe client (test mode). The secret key never leaves the
 * server. Import only from `runtime = "nodejs"` route handlers.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

/** Absolute base URL for building Stripe success/cancel redirect URLs. */
export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
