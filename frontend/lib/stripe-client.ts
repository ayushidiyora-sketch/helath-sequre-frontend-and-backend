import { loadStripe, type Stripe } from "@stripe/stripe-js";

/**
 * Browser Stripe.js singleton (publishable key). Loaded once and reused so the
 * Payment Element mounts without re-fetching the SDK.
 */
let _promise: Promise<Stripe | null> | null = null;

export function getStripePromise(): Promise<Stripe | null> {
  if (!_promise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
    _promise = loadStripe(key);
  }
  return _promise;
}
