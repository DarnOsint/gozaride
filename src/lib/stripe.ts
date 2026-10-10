import Stripe from "stripe";

/** Returns a configured Stripe client, or null when keys are not set. */
export function getStripe(): { stripe: Stripe; secretKey: string } | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return { stripe: new Stripe(key), secretKey: key };
}

/** True when Stripe is configured. */
export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}