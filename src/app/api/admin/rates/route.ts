import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseBody, fail, ok, serverError, isResponse } from "@/lib/http";
import { rateSchema } from "@/lib/validation";
import { currentRate } from "@/lib/rates";

/** Admin: set a new SSP-per-USD rate. Every change is kept as history. */
export async function POST(req: Request) {
  const session = await requireSession(req, ["admin"]);
  if (isResponse(session)) return session;

  const body = await parseBody(req, rateSchema);
  if (isResponse(body)) return body;

  try {
    const rows = await query<{ ssp_per_usd: number; set_at: string }>(
      `INSERT INTO currency_rates (ssp_per_usd, set_by, note)
       VALUES ($1, $2, $3)
       RETURNING ssp_per_usd::float8 AS ssp_per_usd, set_at`,
      [body.ssp_per_usd, session.id, body.note ?? null],
    );
    return ok({ base: "USD", quote: "SSP", ...rows[0] }, 201);
  } catch (err) {
    return serverError("admin rates", err);
  }
}

/** Admin: rate history, newest first. */
export async function GET(req: Request) {
  const session = await requireSession(req, ["admin"]);
  if (isResponse(session)) return session;
  try {
    const history = await query(
      `SELECT r.id, r.ssp_per_usd::float8 AS ssp_per_usd, r.set_at, r.note, u.full_name AS set_by
         FROM currency_rates r
         LEFT JOIN users u ON u.id = r.set_by
        ORDER BY r.set_at DESC, r.id DESC
        LIMIT 100`,
    );
    const current = await currentRate();
    if (!current) return fail(404, "No rate has been set");
    return ok({ current, history });
  } catch (err) {
    return serverError("admin rates list", err);
  }
}
