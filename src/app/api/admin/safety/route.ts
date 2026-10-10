import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, serverError, isResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Admin: list safety incidents, newest first, optionally filtered by status. */
export async function GET(req: Request) {
  const session = await requireSession(req, ["admin"]);
  if (isResponse(session)) return session;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const limitRaw = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

  const where: string[] = [];
  const params: unknown[] = [];
  if (status) {
    params.push(status);
    where.push(`i.status = $${params.length}`);
  }
  params.push(limit);

  try {
    const incidents = await query(
      `SELECT i.id, i.trip_id, i.reported_by, i.kind, i.latitude::float8 AS latitude,
              i.longitude::float8 AS longitude, i.note, i.status, i.acknowledged_at,
              i.resolved_at, i.created_at,
              u.full_name AS reporter_name, u.role AS reporter_role, u.email AS reporter_email
         FROM safety_incidents i
         JOIN users u ON u.id = i.reported_by
         ${where.length ? "WHERE " + where.join(" AND ") : ""}
         ORDER BY i.created_at DESC
         LIMIT $${params.length}`,
      params,
    );
    const open = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM safety_incidents WHERE status = 'open'`,
    );
    return ok({ incidents, open: Number(open[0]?.count ?? 0) });
  } catch (err) {
    return serverError("admin safety", err);
  }
}
