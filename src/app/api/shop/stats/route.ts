import { queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, serverError, isResponse } from "@/lib/http";

/** Shop: today's order count and lifetime revenue from delivered orders, in both currencies. */
export async function GET(req: Request) {
  const session = await requireSession(req, ["shop"]);
  if (isResponse(session)) return session;
  try {
    const row = await queryOne<{
      today: number;
      revenue_usd: number;
      revenue_ssp: number;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now()) AND status <> 'cancelled')::int AS today,
         COALESCE(SUM(total_usd) FILTER (WHERE status = 'delivered'), 0)::float8 AS revenue_usd,
         COALESCE(SUM(total_ssp) FILTER (WHERE status = 'delivered'), 0)::float8 AS revenue_ssp
       FROM shop_orders WHERE shop_id = $1`,
      [session.id],
    );
    return ok({
      today: row?.today ?? 0,
      revenue_usd: row?.revenue_usd ?? 0,
      revenue_ssp: row?.revenue_ssp ?? 0,
    });
  } catch (err) {
    return serverError("shop stats", err);
  }
}
