import { query, queryOne, withTx } from "@/lib/db";
import { requireSession, type Session } from "@/lib/auth";
import { parseBody, ok, failFromError, HttpError, isResponse } from "@/lib/http";
import { shopOrderSchema } from "@/lib/validation";
import { distanceKm } from "@/lib/geo";
import { deliveryFeeUsd, toSspAmount } from "@/lib/shop";
import { ORDER_SELECT } from "@/lib/orders";

/** Customer: place an order from one shop. Stock is checked and reserved in the same transaction. */
export async function POST(req: Request) {
  const session = await requireSession(req, ["customer"]);
  if (isResponse(session)) return session;

  const body = await parseBody(req, shopOrderSchema);
  if (isResponse(body)) return body;

  try {
    const orderId = await withTx(async (db) => {
      const rate = (
        await db.query<{ ssp_per_usd: number }>(
          "SELECT ssp_per_usd::float8 AS ssp_per_usd FROM currency_rates ORDER BY set_at DESC, id DESC LIMIT 1",
        )
      ).rows[0];
      if (!rate) throw new HttpError(503, "Orders are unavailable until an admin sets the exchange rate");


      const productIds = body.items.map((i) => i.product_id);
      const products = (
        await db.query<{
          id: string;
          shop_id: string;
          price_usd: number;
          stock_quantity: number;
          is_active: boolean;
          name: string;
        }>(
          `SELECT id, shop_id, price_usd::float8 AS price_usd, stock_quantity, is_active, name
             FROM products WHERE id = ANY($1::uuid[]) FOR UPDATE`,
          [productIds],
        )
      ).rows;

      if (products.length !== new Set(productIds).size) {
        throw new HttpError(422, "One or more products no longer exist");
      }
      if (products.some((p) => p.shop_id !== body.shop_id)) {
        throw new HttpError(422, "All items must come from the same shop");
      }

      const shop = (
        await db.query<{ is_open: boolean; latitude: number | null; longitude: number | null }>(
          `SELECT is_open, latitude::float8 AS latitude, longitude::float8 AS longitude
             FROM shop_profiles WHERE user_id = $1`,
          [body.shop_id],
        )
      ).rows[0];
      if (!shop) throw new HttpError(404, "Shop not found");
      if (!shop.is_open) throw new HttpError(409, "This shop is closed right now");
      if (shop.latitude === null || shop.longitude === null) {
        throw new HttpError(409, "This shop has not set its location yet");
      }
      let subtotalUsd = 0;
      const lines: Array<{ product_id: string; quantity: number; unit_usd: number; line_usd: number; unit_ssp: number; line_ssp: number }> = [];
      for (const item of body.items) {
        const p = products.find((x) => x.id === item.product_id)!;
        if (p.shop_id !== body.shop_id) throw new HttpError(422, "All items must come from the same shop");
        if (!p.is_active) throw new HttpError(409, `${p.name} is no longer available`);
        if (p.stock_quantity < item.quantity) {
          throw new HttpError(409, `Only ${p.stock_quantity} of ${p.name} left in stock`);
        }
        const lineUsd = Math.round(p.price_usd * item.quantity * 100) / 100;
        subtotalUsd += lineUsd;
        lines.push({
          product_id: p.id,
          quantity: item.quantity,
          unit_usd: p.price_usd,
          line_usd: lineUsd,
          unit_ssp: toSspAmount(p.price_usd, rate.ssp_per_usd),
          line_ssp: toSspAmount(lineUsd, rate.ssp_per_usd),
        });
      }
      subtotalUsd = Math.round(subtotalUsd * 100) / 100;

      const km = distanceKm(
        { lat: shop.latitude, lng: shop.longitude },
        { lat: body.delivery_lat, lng: body.delivery_lng },
      );
      const feeUsd = deliveryFeeUsd(km);
      const totalUsd = Math.round((subtotalUsd + feeUsd) * 100) / 100;
      const subtotalSsp = toSspAmount(subtotalUsd, rate.ssp_per_usd);
      const feeSsp = toSspAmount(feeUsd, rate.ssp_per_usd);

      const order = (
        await db.query<{ id: string }>(
          `INSERT INTO shop_orders (
             shop_id, customer_id, subtotal_ssp, delivery_fee_ssp, total_ssp, total_usd,
             exchange_rate_ssp_per_usd, pickup_lat, pickup_lng, delivery_address,
             delivery_lat, delivery_lng, notes
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           RETURNING id`,
          [
            body.shop_id,
            session.id,
            subtotalSsp,
            feeSsp,
            Math.round((subtotalSsp + feeSsp) * 100) / 100,
            totalUsd,
            rate.ssp_per_usd,
            shop.latitude,
            shop.longitude,
            body.delivery_address,
            body.delivery_lat,
            body.delivery_lng,
            body.notes ?? null,
          ],
        )
      ).rows[0];

      for (const line of lines) {
        await db.query(
          `INSERT INTO shop_order_items
             (order_id, product_id, quantity, unit_price_ssp, unit_price_usd, line_total_ssp, line_total_usd)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [order.id, line.product_id, line.quantity, line.unit_ssp, line.unit_usd, line.line_ssp, line.line_usd],
        );
        const reserved = await db.query(
          "UPDATE products SET stock_quantity = stock_quantity - $2 WHERE id = $1 AND stock_quantity >= $2",
          [line.product_id, line.quantity],
        );
        if (!reserved.rowCount) throw new HttpError(409, "Stock changed while placing the order. Try again.");
      }

      await db.query(
        `INSERT INTO transactions (user_id, type, amount_ssp, amount_usd, currency_used, status, description)
         VALUES ($1, 'shop_payment', $2, $3, 'usd', 'pending', $4)`,
        [session.id, Math.round((subtotalSsp + feeSsp) * 100) / 100, totalUsd, `Shop order ${order.id}`],
      );
      return order.id;
    });

    const created = await queryOne(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
    return ok({ order: created }, 201);
  } catch (err) {
    return failFromError(err, "create order");
  }
}

/** List orders scoped to the caller: customers see their orders, shops their shop's, drivers their deliveries, admins all. */
export async function GET(req: Request) {
  const session = await requireSession(req, ["customer", "shop", "driver", "admin"]);
  if (isResponse(session)) return session;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const limitRaw = Number(url.searchParams.get("limit") ?? 20);
  const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;

  const scoped = scopeFor(session);
  const where = [...scoped.where];
  const params: unknown[] = [...scoped.params];
  if (status) {
    params.push(status);
    where.push(`o.status = $${params.length}`);
  }
  params.push(limit);

  try {
    const rows = await query(
      `${ORDER_SELECT}
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY o.created_at DESC
        LIMIT $${params.length}`,
      params,
    );
    return ok({ orders: rows });
  } catch (err) {
    return failFromError(err, "list orders");
  }
}

function scopeFor(session: Session): { where: string[]; params: unknown[] } {
  switch (session.role) {
    case "customer":
      return { where: ["o.customer_id = $1"], params: [session.id] };
    case "shop":
      return { where: ["o.shop_id = $1"], params: [session.id] };
    case "driver":
      return { where: ["o.driver_id = $1"], params: [session.id] };
    default:
      return { where: [], params: [] };
  }
}
