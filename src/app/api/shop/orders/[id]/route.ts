import { queryOne } from "@/lib/db";
import { requireSession, type Session } from "@/lib/auth";
import { fail, ok, failFromError, isResponse } from "@/lib/http";
import { ORDER_SELECT } from "@/lib/orders";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One order. Visible to its customer, its shop, its driver, and admins. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req, ["customer", "shop", "driver", "admin"]);
  if (isResponse(session)) return session;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return fail(404, "Order not found");

  try {
    const order = await queryOne<{ customer_id: string; shop_id: string; driver_id: string | null }>(
      `${ORDER_SELECT} WHERE o.id = $1`,
      [id],
    );
    if (!order || !canSee(order, session)) return fail(404, "Order not found");
    return ok({ order });
  } catch (err) {
    return failFromError(err, "get order");
  }
}

function canSee(
  order: { customer_id: string; shop_id: string; driver_id: string | null },
  s: Session,
): boolean {
  if (s.role === "admin") return true;
  if (s.role === "customer") return order.customer_id === s.id;
  if (s.role === "shop") return order.shop_id === s.id;
  if (s.role === "driver") return order.driver_id === s.id;
  return false;
}
