import { requireSession } from "@/lib/auth";
import { parseBody, ok, fail, serverError, isResponse } from "@/lib/http";
import { withTx } from "@/lib/db";
import { z } from "zod";

const payoutSchema = z.object({
  usd: z.number().positive().max(100_000),
});

/**
 * Driver payout request: holds the requested USD against the driver's wallet
 * balance and records a 'payout' transaction as pending for admin settlement.
 * No funds leave the platform automatically; an admin completes the payout
 * once the transfer is arranged (see the admin panel /nen).
 */
export async function POST(req: Request) {
  const session = await requireSession(req, ["driver"]);
  if (isResponse(session)) return session;

  const body = await parseBody(req, payoutSchema);
  if (isResponse(body)) return body;

  try {
    await withTx(async (db) => {
      const bal = await db.query<{ usd_balance: number }>(
        "SELECT usd_balance::float8 AS usd_balance FROM wallets WHERE user_id = $1",
        [session.id],
      );
      if (!bal.rows[0] || bal.rows[0].usd_balance < body.usd) {
        throw new Error("Insufficient USD balance");
      }
      await db.query("UPDATE wallets SET usd_balance = usd_balance - $1 WHERE user_id = $2", [
        body.usd,
        session.id,
      ]);
      await db.query(
        `INSERT INTO transactions (user_id, type, amount_ssp, amount_usd, currency_used, status, description)
         VALUES ($1, 'payout', $2, $3, 'usd', 'pending', 'Payout request awaiting settlement')`,
        [session.id, 0, body.usd],
      );
    });
    return ok({ requested: body.usd }, 201);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Insufficient USD balance") return fail(409, err.message);
    return serverError("payout request", err);
  }
}