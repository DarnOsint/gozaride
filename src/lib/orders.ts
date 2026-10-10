/**
 * Shared SELECT for shop orders, with the customer and shop names and the
 * line items as JSON. Callers append a WHERE clause and ORDER/LIMIT.
 */
export const ORDER_SELECT = `
  SELECT
    o.id,
    o.shop_id,
    o.customer_id,
    o.driver_id,
    o.status,
    o.subtotal_ssp::float8 AS subtotal_ssp,
    o.delivery_fee_ssp::float8 AS delivery_fee_ssp,
    o.total_ssp::float8 AS total_ssp,
    o.total_usd::float8 AS total_usd,
    o.exchange_rate_ssp_per_usd::float8 AS exchange_rate_ssp_per_usd,
    o.delivery_address,
    o.delivery_lat::float8 AS delivery_lat,
    o.delivery_lng::float8 AS delivery_lng,
    o.pickup_lat::float8 AS pickup_lat,
    o.pickup_lng::float8 AS pickup_lng,
    o.notes,
    o.created_at,
    o.confirmed_at,
    o.ready_at,
    o.picked_up_at,
    o.delivered_at,
    o.cancelled_at,
    o.cancel_reason,
    cu.full_name AS customer_name,
    sp.shop_name,
    COALESCE((
      SELECT json_agg(json_build_object(
               'product_id', i.product_id,
               'product_name', p.name,
               'quantity', i.quantity,
               'unit_price_usd', i.unit_price_usd::float8,
               'line_total_usd', i.line_total_usd::float8,
               'line_total_ssp', i.line_total_ssp::float8
             ) ORDER BY p.name)
        FROM shop_order_items i
        JOIN products p ON p.id = i.product_id
       WHERE i.order_id = o.id
    ), '[]'::json) AS items
  FROM shop_orders o
  JOIN users cu ON cu.id = o.customer_id
  LEFT JOIN shop_profiles sp ON sp.user_id = o.shop_id
`;
