import { withTx } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseBody, fail, ok, serverError, isResponse } from "@/lib/http";
import { notify } from "@/lib/push";
import { z } from "zod";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const schema = z.object({
  action: z.enum(["settle", "reject"]),
  note: z.string().trim().max(300).optional(),
});

/**
 * Admin: settle a payout (mark the transfer done) or reject it (return the
 * held funds to the driver's wallet).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req, ["admin"]);
  if (isResponse(session)) return session;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return fail(404, "Payout not found");

  const body = await parseBody(req, schema);
  if (isResponse(body)) return body;

  try {
    const driverId = await withTx(async (db) => {
      const payout = (
        await db.query<{ user_id: string; amount_usd: number; status: string }>(
          `SELECT user_id, amount_usd::float8 AS amount_usd, status
             FROM transactions WHERE id = $1 AND type = 'payout' FOR UPDATE`,
          [id],
        )
      ).rows[0];
      if (!payout) throw new Error("NOT_FOUND");
      if (payout.status !== "pending") throw new Error("NOT_PENDING");

      if (body.action === "settle") {
        await db.query(
          `UPDATE transactions SET status = 'completed', description = $2 WHERE id = $1`,
          [id, body.note ? `Payout settled: ${body.note}` : "Payout settled by admin"],
        );
      } else {
        await db.query(
          `UPDATE transactions SET status = 'failed', description = $2 WHERE id = $1`,
          [id, body.note ? `Payout rejected: ${body.note}` : "Payout rejected by admin"],
        );
        // Return the held funds to the driver.
        await db.query(`UPDATE wallets SET usd_balance = usd_balance + $1 WHERE user_id = $2`, [
          payout.amount_usd,
          payout.user_id,
        ]);
      }
      return payout.user_id;
    });

    await notify(driverId, {
      title: body.action === "settle" ? "Payout settled" : "Payout rejected",
      body:
        body.action === "settle"
          ? "Your payout has been sent."
          : "Your payout request was declined and the funds were returned to your wallet.",
      kind: "payout",
      data: { payout_id: id },
    });
    return ok({ id, action: body.action });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") return fail(404, "Payout not found");
    if (err instanceof Error && err.message === "NOT_PENDING") {
      return fail(409, "This payout has already been handled");
    }
    return serverError("admin payout action", err);
  }
}
