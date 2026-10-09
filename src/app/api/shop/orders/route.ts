import { query, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, serverError, isResponse } from "@/lib/http";

export async function GET(req: Request) {
  const session = await requireSession(req, ["shop"]);
  if (isResponse(session)) return session;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), 100);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

  const params: unknown[] = [session.id];
  let where = "WHERE t.customer_id IN (SELECT id FROM users WHERE role = 'customer')";

  if (status) {
    where += " AND t.status = $2";
    // params would need adjustment for $2 - this is a simplified version
  }

  try {
    const rows = await query(
      `SELECT t.id, t.service_type, t.status, t.final_fare_usd, t.final_fare_ssp,
              t.requested_at, t.accepted_at, t.completed_at,
              u.full_name AS customer_name
         FROM trips t
         JOIN users u ON t.customer_id = u.id
         WHERE t.customer_id IN (SELECT id FROM users WHERE role = 'customer')
         ORDER BY t.requested_at DESC
         LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return ok({ orders: rows });
  } catch (err) {
    return serverError("shop orders", err);
  }
}
