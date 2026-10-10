import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, serverError, isResponse } from "@/lib/http";
import { TRIP_COLUMNS } from "@/lib/trips";

export async function GET(req: Request) {
  const session = await requireSession(req, ["admin"]);
  if (isResponse(session)) return session;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  const page = Math.max(Number(url.searchParams.get("page") ?? 1), 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100);
  const offset = (page - 1) * limit;

  const where: string[] = [];
  const params: unknown[] = [];
  if (status) { params.push(status); where.push(`t.status = $${params.length}`); }
  if (type) { params.push(type); where.push(`t.service_type = $${params.length}`); }
  params.push(limit, offset);

  try {
    const rows = await query(
      `SELECT ${TRIP_COLUMNS}, u_c.full_name AS customer_name, u_d.full_name AS driver_name
         FROM trips t
         JOIN users u_c ON t.customer_id = u_c.id
         LEFT JOIN users u_d ON t.driver_id = u_d.id
         ${where.length ? "WHERE " + where.join(" AND ") : ""}
         ORDER BY t.requested_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return ok({ trips: rows });
  } catch (err) {
    return serverError("admin trips list", err);
  }
}
