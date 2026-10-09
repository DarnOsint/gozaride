import { queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, serverError, isResponse } from "@/lib/http";

export async function GET(req: Request) {
  const session = await requireSession(req, ["shop"]);
  if (isResponse(session)) return session;

  try {
    const today = await queryOne<{ today: number }>(
      `SELECT COUNT(*)::int AS today FROM trips
        WHERE status IN ('accepted', 'in_progress', 'completed')
          AND requested_at >= CURRENT_DATE`,
    );
    const revenue = await queryOne<{ usd: number; ssp: number }>(
      `SELECT COALESCE(SUM(final_fare_usd), 0)::float8 AS usd,
              COALESCE(SUM(round(final_fare_usd * exchange_rate_ssp_per_usd, 2)), 0)::float8 AS ssp
         FROM trips WHERE status = 'completed'`,
    );
    return ok({ today: today?.today ?? 0, revenue_usd: revenue?.usd ?? 0, revenue_ssp: revenue?.ssp ?? 0 });
  } catch (err) {
    return serverError("shop stats", err);
  }
}
