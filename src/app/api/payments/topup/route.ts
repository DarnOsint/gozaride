import { requireSession } from "@/lib/auth";
import { parseBody, ok, fail, serverError, isResponse } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { z } from "zod";

const topUpSchema = z.object({
  usd: z.number().positive().max(1_000_000),
});

const SUCCESS_URL = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.BASE_URL ?? "https://gozaride.com";

/**
 * Wallet top-up: creates a Stripe Checkout Session for the requested USD
 * amount. The customer completes payment on Stripe's hosted page; the webhook
 * credits the wallet afterwards. Returns { url } to redirect the browser to.
 */
export async function POST(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;

  const body = await parseBody(req, topUpSchema);
  if (isResponse(body)) return body;

  const cfg = getStripe();
  if (!cfg) return fail(503, "Payments are not configured yet");

  try {
    const checkout = await cfg.stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: session.id,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: Math.round(body.usd * 100),
            product_data: {
              name: "Gozaride wallet top-up",
              description: `Add $${body.usd.toFixed(2)} to your Gozaride wallet`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: session.id,
        purpose: "wallet_topup",
      },
      success_url: `${SUCCESS_URL}/profile?payment=success`,
      cancel_url: `${SUCCESS_URL}/profile?payment=cancelled`,
    });

    if (!checkout.url) return fail(500, "Stripe did not return a checkout URL");
    return ok({ url: checkout.url, session_id: checkout.id });
  } catch (err) {
    return serverError("payment topup", err);
  }
}