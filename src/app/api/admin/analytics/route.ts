import { query, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, serverError, isResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Admin: platform analytics — users, trips, orders, revenue and payouts. */
export async function GET(req: Request) {
  const session = await requireSession(req, ["admin"]);
  if (isResponse(session)) return session;

  try {
    const [users, trips, orders, tripMoney, orderMoney, payouts, safety] = await Promise.all([
      query<{ role: string; count: string }>(
        `SELECT role, COUNT(*)::text AS count FROM users GROUP BY role`,
      ),
      query<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::text AS count FROM trips GROUP BY status`,
      ),
      query<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::text AS count FROM shop_orders GROUP BY status`,
      ),
      queryOne<{ completed: string; gross_fare_usd: number; commission_usd: number }>(
        `SELECT COUNT(*)::text AS completed,
                COALESCE(SUM(fare_usd), 0)::float8 AS gross_fare_usd,
                COALESCE(SUM(fare_usd * commission_rate), 0)::float8 AS commission_usd
           FROM trips WHERE status = 'completed'`,
      ),
      queryOne<{ delivered: string; gmv_usd: number }>(
        `SELECT COUNT(*)::text AS delivered, COALESCE(SUM(total_usd), 0)::float8 AS gmv_usd
           FROM shop_orders WHERE status = 'delivered'`,
      ),
      queryOne<{ pending: string; pending_usd: number; settled: string; settled_usd: number }>(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'pending')::text AS pending,
           COALESCE(SUM(amount_usd) FILTER (WHERE status = 'pending'), 0)::float8 AS pending_usd,
           COUNT(*) FILTER (WHERE status = 'completed')::text AS settled,
           COALESCE(SUM(amount_usd) FILTER (WHERE status = 'completed'), 0)::float8 AS settled_usd
         FROM transactions WHERE type = 'payout'`,
      ),
      queryOne<{ open: string }>(
        `SELECT COUNT(*)::text AS open FROM safety_incidents WHERE status = 'open'`,
      ),
    ]);

    const toMap = (rows: Array<{ [k: string]: string }>, key: string) =>
      Object.fromEntries(rows.map((r) => [r[key], Number(r.count)]));

    return ok({
      users: {
        by_role: toMap(users, "role"),
        total: users.reduce((sum, r) => sum + Number(r.count), 0),
      },
      trips: {
        by_status: toMap(trips, "status"),
        total: trips.reduce((sum, r) => sum + Number(r.count), 0),
        completed: Number(tripMoney?.completed ?? 0),
        gross_fare_usd: tripMoney?.gross_fare_usd ?? 0,
        commission_usd: Math.round((tripMoney?.commission_usd ?? 0) * 100) / 100,
      },
      orders: {
        by_status: toMap(orders, "status"),
        total: orders.reduce((sum, r) => sum + Number(r.count), 0),
        delivered: Number(orderMoney?.delivered ?? 0),
        gmv_usd: orderMoney?.gmv_usd ?? 0,
      },
      payouts: {
        pending: Number(payouts?.pending ?? 0),
        pending_usd: payouts?.pending_usd ?? 0,
        settled: Number(payouts?.settled ?? 0),
        settled_usd: payouts?.settled_usd ?? 0,
      },
      safety_open: Number(safety?.open ?? 0),
    });
  } catch (err) {
    return serverError("admin analytics", err);
  }
}
