import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, serverError, isResponse } from "@/lib/http";

export async function GET(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;

  try {
    const rows = await query<{ ssp_balance: number; usd_balance: number }>(
      `SELECT ssp_balance::float8 AS ssp_balance, usd_balance::float8 AS usd_balance
         FROM wallets WHERE user_id = $1`,
      [session.id],
    );
    return ok(rows[0] ?? { ssp_balance: 0, usd_balance: 0 });
  } catch (err) {
    return serverError("wallet", err);
  }
}