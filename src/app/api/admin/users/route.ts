import { query, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, serverError, isResponse } from "@/lib/http";

export async function GET(req: Request) {
  const session = await requireSession(req, ["admin"]);
  if (isResponse(session)) return session;

  const url = new URL(req.url);
  const role = url.searchParams.get("role");
  const page = Math.max(Number(url.searchParams.get("page") ?? 1), 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100);
  const offset = (page - 1) * limit;

  const where = role ? "WHERE role = $1" : "";
  const params = role ? [role, limit, offset] : [limit, offset];

  try {
    const rows = await query(
      `SELECT id, email, full_name, role, is_active, created_at, last_login_at
         FROM users ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const total = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM users ${where}`,
      params.slice(0, role ? 1 : 0),
    );
    return ok({ users: rows, pagination: { total: total?.count ?? 0, page, total_pages: Math.ceil((total?.count ?? 0) / 50) } });
  } catch (err) {
    return serverError("admin users list", err);
  }
}
