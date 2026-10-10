import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseBody, fail, ok, serverError, isResponse } from "@/lib/http";
import { productSchema } from "@/lib/validation";
import { currentRate } from "@/lib/rates";
import { toSspAmount } from "@/lib/shop";

const PRODUCT_COLUMNS = `id, name, description, price_usd::float8 AS price_usd,
  price_ssp::float8 AS price_ssp, category, image_url, stock_quantity, is_active, created_at`;

/** Shop: list own products. */
export async function GET(req: Request) {
  const session = await requireSession(req, ["shop"]);
  if (isResponse(session)) return session;
  try {
    const rows = await query(
      `SELECT ${PRODUCT_COLUMNS} FROM products WHERE shop_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [session.id],
    );
    return ok({ products: rows });
  } catch (err) {
    return serverError("list products", err);
  }
}

/** Shop: add a product. SSP price is derived from the current admin rate. */
export async function POST(req: Request) {
  const session = await requireSession(req, ["shop"]);
  if (isResponse(session)) return session;

  const body = await parseBody(req, productSchema);
  if (isResponse(body)) return body;

  try {
    const rate = await currentRate();
    if (!rate) return fail(503, "Products cannot be priced until an admin sets the exchange rate");
    const rows = await query(
      `INSERT INTO products (shop_id, name, description, price_usd, price_ssp, category, image_url, stock_quantity, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${PRODUCT_COLUMNS}`,
      [
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
    return ok({ product: rows[0] }, 201);
  } catch (err) {
    return serverError("create product", err);
  }
}
