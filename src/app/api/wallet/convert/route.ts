import { withTx } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseBody, fail, ok, serverError, isResponse } from "@/lib/http";
import { currentRate } from "@/lib/rates";
import { z } from "zod";

const convertSchema = z.object({ usd: z.number().positive().max(1_000_000) });

export async function POST(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;

  const body = await parseBody(req, convertSchema);
  if (isResponse(body)) return body;

  try {
    const rate = await currentRate();
    if (!rate) return fail(503, "Exchange rate not set");

    const amountSsp = Math.round(body.usd * rate.ssp_per_usd * 100) / 100;

    await withTx(async (db) => {
      const bal = await db.query<{ usd_balance: number }>(
        "SELECT usd_balance::float8 AS usd_balance FROM wallets WHERE user_id = $1",
        [session.id],
      );
      if (!bal.rows[0] || bal.rows[0].usd_balance < body.usd) {
        throw new Error("Insufficient USD balance");
      }
      const amountSsp = Math.round(body.usd * rate.ssp_per_usd * 100) / 100;
      await db.query(
        "UPDATE wallets SET usd_balance = usd_balance - $1, ssp_balance = ssp_balance + $2 WHERE user_id = $3",
        [body.usd, amountSsp, session.id],
      );
      await db.query(
        `INSERT INTO transactions (user_id, type, amount_ssp, amount_usd, currency_used, status, description)
         VALUES ($1, 'convert', $2, $3, 'ssp', 'completed', 'USD to SSP conversion')`,
        [session.id, amountSsp, body.usd],
      );
    });
    return ok({ converted_ssp: amountSsp });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Insufficient USD balance") return fail(409, err.message);
    return serverError("wallet convert", err);
  }
}
