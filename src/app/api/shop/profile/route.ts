import { query, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseBody, fail, ok, serverError, isResponse } from "@/lib/http";
import { shopProfileSchema } from "@/lib/validation";

/** Shop: read own profile. */
export async function GET(req: Request) {
  const session = await requireSession(req, ["shop"]);
  if (isResponse(session)) return session;
  try {
    const profile = await queryOne(
      `SELECT shop_name, address, latitude::float8 AS latitude, longitude::float8 AS longitude, is_open
         FROM shop_profiles WHERE user_id = $1`,
      [session.id],
    );
    return ok({ profile });
  } catch (err) {
    return serverError("shop profile get", err);
  }
}

/** Shop: set name, address, and pickup coordinates. Required before orders can be placed. */
export async function PUT(req: Request) {
  const session = await requireSession(req, ["shop"]);
  if (isResponse(session)) return session;

  const body = await parseBody(req, shopProfileSchema);
  if (isResponse(body)) return body;

  try {
    const rows = await query(
      `UPDATE shop_profiles
          SET shop_name = $2, address = $3, latitude = $4, longitude = $5, is_open = $6
        WHERE user_id = $1
        RETURNING shop_name, address, latitude::float8 AS latitude, longitude::float8 AS longitude, is_open`,
      [session.id, body.shop_name, body.address ?? null, body.latitude, body.longitude, body.is_open],
    );
    if (!rows.length) return fail(404, "Shop profile not found");
    return ok({ profile: rows[0] });
  } catch (err) {
    return serverError("shop profile update", err);
  }
}
