import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { fail, ok, serverError, isResponse } from "@/lib/http";
import { ORDER_SELECT } from "@/lib/orders";

/** Driver: shop orders that are ready for pickup and not yet taken. */
export async function GET(req: Request) {
  const session = await requireSession(req, ["driver"]);
  if (isResponse(session)) return session;
  try {
    const driver = await query<{ is_online: boolean }>(
      "SELECT is_online FROM driver_profiles WHERE user_id = $1",
      [session.id],
    );
    if (!driver[0]?.is_online) return fail(409, "Go online to see delivery requests");
    const rows = await query(
      `${ORDER_SELECT} WHERE o.status = 'ready_for_pickup' AND o.driver_id IS NULL
        ORDER BY o.ready_at ASC NULLS LAST, o.created_at ASC LIMIT 50`,
    );
    return ok({ orders: rows });
  } catch (err) {
    return serverError("available orders", err);
  }
}
