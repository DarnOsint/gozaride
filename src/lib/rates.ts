import { queryOne } from "./db";

export type CurrentRate = { ssp_per_usd: number; set_at: string };

/** The admin-set rate in force now, or null if no rate has ever been set. */
export async function currentRate(): Promise<CurrentRate | null> {
  return queryOne<CurrentRate>(
    `SELECT ssp_per_usd::float8 AS ssp_per_usd, set_at
       FROM currency_rates
      ORDER BY set_at DESC, id DESC
      LIMIT 1`,
  );
}
