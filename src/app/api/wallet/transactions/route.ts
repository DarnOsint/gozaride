import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, serverError, isResponse } from "@/lib/http";

export async function GET(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), 100);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

  try {
    const rows = await query(
      `SELECT id, type, amount_ssp::float8 AS amount_ssp, amount_usd::float8 AS amount_usd,
              currency_used, status, description, created_at
         FROM transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [session.id, limit, offset],
    );
    return ok({ transactions: rows });
  } catch (err) {
    return serverError("wallet transactions", err);
  }
}
