import { withTx } from "@/lib/db";
import { fail, ok, serverError } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import Stripe from "stripe";

/**
 * Stripe webhook for wallet top-up. Handles checkout.session.completed and
 * credits the user's wallet exactly once (idempotent via transactions.reference
 * == stripe session id).
 */
export async function POST(req: Request) {
  const cfg = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!cfg || !secret) return fail(503, "Payments are not configured yet");

  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return fail(400, "Missing Stripe signature");

  let event: Stripe.Event;
  try {
    event = cfg.stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    return fail(400, `Webhook signature verification failed`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const check = event.data.object as Stripe.Checkout.Session;
      const userId = check.metadata?.userId;
      if (!userId || check.metadata?.purpose !== "wallet_topup") {
        return ok({ received: true, skipped: "non topup session" });
      }
      const amountUsd = Math.round(((check.amount_total ?? 0) / 100) * 100) / 100;
      if (amountUsd <= 0) return ok({ received: true, skipped: "zero amount" });

      await withTx(async (db) => {
        // Idempotency: if this Stripe session was already processed, do nothing.
        const existing = await db.query(
          "SELECT 1 FROM transactions WHERE reference = $1",
          [`stripe:${check.id}`],
        );
        if (existing.rowCount) return;

        await db.query("UPDATE wallets SET usd_balance = usd_balance + $1 WHERE user_id = $2", [
          amountUsd,
          userId,
        ]);
        await db.query(
          `INSERT INTO transactions (user_id, type, amount_ssp, amount_usd, currency_used, status, description, reference)
           VALUES ($1, 'deposit', $2, $3, 'usd', 'completed', 'Wallet top-up via card', $4)`,
          [userId, Math.round(amountUsd * 0), amountUsd, `stripe:${check.id}`],
        );
      });
      return ok({ received: true, credited: amountUsd });
    }

    return ok({ received: true });
  } catch (err) {
    return serverError("payment webhook", err);
  }
}