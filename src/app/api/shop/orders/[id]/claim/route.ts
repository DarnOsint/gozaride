import { withTx } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { fail, ok, failFromError, HttpError, isResponse } from "@/lib/http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Driver: take a ready order for delivery. One delivery at a time per driver. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req, ["driver"]);
  if (isResponse(session)) return session;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return fail(404, "Order not found");

  try {
    await withTx(async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [session.id]);

      const driver = (
        await db.query<{ is_online: boolean }>(
          "SELECT is_online FROM driver_profiles WHERE user_id = $1",
          [session.id],
        )
      ).rows[0];
      if (!driver?.is_online) throw new HttpError(409, "Go online before taking deliveries");

      const busy = await db.query(
        `SELECT 1 FROM trips WHERE driver_id = $1 AND status IN ('accepted','in_progress')
         UNION ALL
         SELECT 1 FROM shop_orders WHERE driver_id = $1 AND status = 'out_for_delivery'
         LIMIT 1`,
        [session.id],
      );
      if (busy.rowCount) throw new HttpError(409, "Finish your current delivery first");

      const claimed = await db.query(
        `UPDATE shop_orders
            SET driver_id = $2, status = 'out_for_delivery', picked_up_at = now()
          WHERE id = $1 AND status = 'ready_for_pickup' AND driver_id IS NULL
          RETURNING id`,
        [id, session.id],
      );
      if (!claimed.rowCount) throw new HttpError(409, "This order is no longer available");
    });
    return ok({ id, status: "out_for_delivery" });
  } catch (err) {
    return failFromError(err, "claim order");
  }
}
