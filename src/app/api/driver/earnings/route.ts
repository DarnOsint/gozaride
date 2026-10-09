import { queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, serverError, isResponse } from "@/lib/http";

export async function GET(req: Request) {
  const session = await requireSession(req, ["driver"]);
  if (isResponse(session)) return session;

  try {
    const total = await queryOne<{ total_usd: number; total_ssp: number }>(
      `SELECT COALESCE(SUM(net_earnings_usd), 0)::float8 AS total_usd,
              COALESCE(SUM(net_earnings_ssp), 0)::float8 AS total_ssp
         FROM earnings_history WHERE driver_id = $1`,
      [session.id],
    );
    const week = await queryOne<{ week_usd: number; week_ssp: number }>(
      `SELECT COALESCE(SUM(net_earnings_usd), 0)::float8 AS week_usd,
              COALESCE(SUM(net_earnings_ssp), 0)::float8 AS week_ssp
         FROM earnings_history
        WHERE driver_id = $1 AND paid_at >= now() - interval '7 days'`,
      [session.id],
    );
    return ok({
      total_usd: total?.total_usd ?? 0,
      total_ssp: total?.total_ssp ?? 0,
      this_week_usd: week?.week_usd ?? 0,
      this_week_ssp: week?.week_ssp ?? 0,
    });
  } catch (err) {
    return serverError("driver earnings", err);
  }
}
