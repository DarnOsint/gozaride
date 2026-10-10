import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseBody, fail, ok, serverError, isResponse } from "@/lib/http";
import { productSchema } from "@/lib/validation";
import { currentRate } from "@/lib/rates";
import { toSspAmount } from "@/lib/shop";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRODUCT_COLUMNS = `id, name, description, price_usd::float8 AS price_usd,
  price_ssp::float8 AS price_ssp, category, image_url, stock_quantity, is_active, created_at`;

/** Shop: update one of own products. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req, ["shop"]);
  if (isResponse(session)) return session;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return fail(404, "Product not found");

  const body = await parseBody(req, productSchema);
  if (isResponse(body)) return body;

  try {
    const rate = await currentRate();
    if (!rate) return fail(503, "Products cannot be priced until an admin sets the exchange rate");
    const rows = await query(
      `UPDATE products
          SET name = $3, description = $4, price_usd = $5, price_ssp = $6, category = $7,
              image_url = $8, stock_quantity = $9, is_active = $10, updated_at = now()
        WHERE id = $1 AND shop_id = $2
        RETURNING ${PRODUCT_COLUMNS}`,
      [
        id,
        session.id,
        body.name,
        body.description ?? null,
        body.price_usd,
        toSspAmount(body.price_usd, rate.ssp_per_usd),
        body.category,
        body.image_url ?? null,
        body.stock_quantity,
        body.is_active,
      ],
    );
    if (!rows.length) return fail(404, "Product not found");
    return ok({ product: rows[0] });
  } catch (err) {
    return serverError("update product", err);
  }
}

/** Shop: deactivate a product. Products are never hard-deleted so past orders keep their references. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req, ["shop"]);
  if (isResponse(session)) return session;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return fail(404, "Product not found");
  try {
    const rows = await query(
      "UPDATE products SET is_active = false, updated_at = now() WHERE id = $1 AND shop_id = $2 RETURNING id",
      [id, session.id],
    );
    if (!rows.length) return fail(404, "Product not found");
    return ok({ id, is_active: false });
  } catch (err) {
    return serverError("deactivate product", err);
  }
}
