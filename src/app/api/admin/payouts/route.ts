import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, serverError, isResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Admin: list driver payout requests awaiting settlement (or all). */
export async function GET(req: Request) {
  const session = await requireSession(req, ["admin"]);
  if (isResponse(session)) return session;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "pending";
  const limitRaw = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

  try {
    const payouts = await query(
      `SELECT t.id, t.user_id, t.amount_usd::float8 AS amount_usd, t.status,
              t.description, t.created_at,
              u.full_name AS driver_name, u.email AS driver_email
         FROM transactions t
         JOIN users u ON u.id = t.user_id
        WHERE t.type = 'payout' AND t.status = $1
        ORDER BY t.created_at DESC
        LIMIT $2`,
      [status, limit],
    );
    return ok({ payouts });
  } catch (err) {
    return serverError("admin payouts", err);
  }
}
