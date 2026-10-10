import { queryOne, withTx } from "@/lib/db";
import { requireSession, type Session } from "@/lib/auth";
import { parseBody, fail, ok, failFromError, HttpError, isResponse } from "@/lib/http";
import { orderStatusSchema } from "@/lib/validation";
import { SHOP_TRANSITIONS } from "@/lib/shop";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TIMESTAMP_FOR: Record<string, string> = {
  confirmed: "confirmed_at",
  ready_for_pickup: "ready_at",
  out_for_delivery: "picked_up_at",
  delivered: "delivered_at",
  cancelled: "cancelled_at",
};

/**
 * Move an order through its lifecycle.
 * Shops: confirm, prepare, mark ready, or cancel.
 * Customers: cancel while still pending or confirmed.
 * Assigned driver: mark delivered.
 * Drivers pick up orders through /claim, which sets out_for_delivery.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req, ["customer", "shop", "driver"]);
  if (isResponse(session)) return session;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return fail(404, "Order not found");

  const body = await parseBody(req, orderStatusSchema);
  if (isResponse(body)) return body;

  try {
    await withTx(async (db) => {
      const current = (
        await db.query<{ status: string; shop_id: string; customer_id: string; driver_id: string | null }>(
          "SELECT status, shop_id, customer_id, driver_id FROM shop_orders WHERE id = $1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!current) throw new HttpError(404, "Order not found");

      assertMayMove(session, current, body.status);

      const allowed = SHOP_TRANSITIONS[current.status] ?? [];
      if (!allowed.includes(body.status)) {
        throw new HttpError(409, `Cannot change an order from ${current.status} to ${body.status}`);
      }

      const stamp = TIMESTAMP_FOR[body.status];
      await db.query(
        `UPDATE shop_orders
            SET status = $2
              ${stamp ? `, ${stamp} = now()` : ""}
              ${body.status === "cancelled" ? ", cancel_reason = $3" : ""}
          WHERE id = $1`,
        body.status === "cancelled" ? [id, body.status, body.reason ?? null] : [id, body.status],
      );

      if (body.status === "cancelled") {
        // Return reserved stock.
        await db.query(
          `UPDATE products p SET stock_quantity = p.stock_quantity + i.quantity
             FROM shop_order_items i
            WHERE i.order_id = $1 AND p.id = i.product_id`,
          [id],
        );
      }
    });
    return ok({ id, status: (await readStatus(id)) });
  } catch (err) {
    return failFromError(err, "order status");
  }
}

function assertMayMove(
  s: Session,
  order: { shop_id: string; customer_id: string; driver_id: string | null; status: string },
  target: string,
) {
  if (s.role === "shop") {
    if (order.shop_id !== s.id) throw new HttpError(403, "This is not your shop's order");
    if (target === "out_for_delivery" || target === "delivered") {
      throw new HttpError(403, "Shops cannot mark an order as delivered");
    }
    return;
  }
  if (s.role === "customer") {
    if (order.customer_id !== s.id) throw new HttpError(403, "This is not your order");
    if (target !== "cancelled") throw new HttpError(403, "Customers can only cancel orders");
    if (!["pending", "confirmed"].includes(order.status)) {
      throw new HttpError(409, "This order can no longer be cancelled");
    }
    return;
  }
  if (s.role === "driver") {
    if (order.driver_id !== s.id) throw new HttpError(403, "This order is not assigned to you");
    if (target !== "delivered") throw new HttpError(403, "Drivers can only mark an order as delivered");
    return;
  }
}

async function readStatus(id: string): Promise<string | null> {
  const row = await queryOne<{ status: string }>("SELECT status FROM shop_orders WHERE id = $1", [id]);
  return row?.status ?? null;
}
