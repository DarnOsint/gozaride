import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, serverError, isResponse } from "@/lib/http";

// Driver: list payout requests (both pending and settled), newest first.
export async function GET(req: Request) {
  const session = await requireSession(req, ["driver"]);
  if (isResponse(session)) return session;

  try {
    const rows = await query(
      `SELECT id, amount_usd::float8 AS amount_usd, status, description, created_at
         FROM transactions
        WHERE user_id = $1 AND type = 'payout'
        ORDER BY created_at DESC
        LIMIT 50`,
      [session.id],
    );
    return ok({ payouts: rows });
  } catch (err) {
    return serverError("payout list", err);
  }
}