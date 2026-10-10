import { randomBytes } from "crypto";
import type { PoolClient } from "pg";
import { query, withTx } from "./db";
import { HttpError } from "./http";

/** 100 loyalty points redeem for $1 of wallet balance. */
export const POINTS_PER_USD = 100;
/** Points earned per $1 spent by a customer. */
export const CUSTOMER_POINTS_PER_USD = 10;
/** Points earned per $1 net earnings by a driver. */
export const DRIVER_POINTS_PER_USD = 5;
/** Cash reward paid to a referrer when their invite signs up. */
export const REFERRAL_REWARD_USD = 1;
/** Bonus points for both parties on a successful referral. */
export const REFERRAL_BONUS_POINTS = 50;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A human-friendly, unambiguous referral code. */
export function newReferralCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i += 1) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/**
 * Award (or, with negative points, spend) loyalty points. Must run inside a
 * transaction so the wallet update and the ledger entry stay consistent.
 */
export async function awardPoints(
  db: PoolClient,
  userId: string,
  points: number,
  reason: string,
  ref?: string,
): Promise<void> {
  if (points === 0) return;
  await db.query(`INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
  await db.query(`UPDATE wallets SET loyalty_points = loyalty_points + $2 WHERE user_id = $1`, [
    userId,
    points,
  ]);
  await db.query(
    `INSERT INTO loyalty_events (user_id, points, reason, ref) VALUES ($1, $2, $3, $4)`,
    [userId, points, reason, ref ?? null],
  );
}

/** Points a customer earns for a fare of the given USD value. */
export function pointsForFare(usd: number): number {
  return Math.floor(usd * CUSTOMER_POINTS_PER_USD);
}

/** Points a driver earns for net earnings of the given USD value. */
export function pointsForEarnings(usd: number): number {
  return Math.floor(usd * DRIVER_POINTS_PER_USD);
}

export type LoyaltySummary = {
  points: number;
  value_usd: number;
  referral_code: string | null;
  referrals: number;
  events: Array<{ id: string; points: number; reason: string; ref: string | null; created_at: string }>;
};

/** Read a user's loyalty balance, referral code and recent ledger. */
export async function getLoyalty(userId: string): Promise<LoyaltySummary> {
  const wallet = await query<{ loyalty_points: number }>(
    `SELECT COALESCE(loyalty_points, 0) AS loyalty_points FROM wallets WHERE user_id = $1`,
    [userId],
  );
  const user = await query<{ referral_code: string | null }>(
    `SELECT referral_code FROM users WHERE id = $1`,
    [userId],
  );
  const events = await query<{ id: string; points: number; reason: string; ref: string | null; created_at: string }>(
    `SELECT id, points, reason, ref, created_at
       FROM loyalty_events WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 30`,
    [userId],
  );
  const refs = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM referrals WHERE referrer_id = $1`,
    [userId],
  );

  const points = wallet[0]?.loyalty_points ?? 0;
  return {
    points,
    value_usd: Math.round((points / POINTS_PER_USD) * 100) / 100,
    referral_code: user[0]?.referral_code ?? null,
    referrals: Number(refs[0]?.count ?? 0),
    events,
  };
}

/** Convert loyalty points into wallet USD. */
export async function redeemPoints(userId: string, points: number): Promise<{ points: number; usd: number }> {
  if (!Number.isInteger(points) || points <= 0) throw new HttpError(422, "Enter a positive number of points");
  if (points < POINTS_PER_USD) throw new HttpError(422, `Redeem at least ${POINTS_PER_USD} points`);
  const usd = Math.round((points / POINTS_PER_USD) * 100) / 100;

  return withTx(async (db) => {
    const row = (
      await db.query<{ loyalty_points: number }>(
        `SELECT COALESCE(loyalty_points, 0) AS loyalty_points FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [userId],
      )
    ).rows[0];
    const balance = row?.loyalty_points ?? 0;
    if (balance < points) throw new HttpError(409, "You do not have that many points");

    await db.query(`UPDATE wallets SET loyalty_points = loyalty_points - $2, usd_balance = usd_balance + $3 WHERE user_id = $1`, [
      userId,
      points,
      usd,
    ]);
    await db.query(
      `INSERT INTO loyalty_events (user_id, points, reason, ref) VALUES ($1, $2, 'redeemed', NULL)`,
      [userId, -points],
    );
    await db.query(
      `INSERT INTO transactions (user_id, type, amount_ssp, amount_usd, currency_used, status, description)
       VALUES ($1, 'convert', 0, $2, 'usd', 'completed', $3)`,
      [userId, usd, `Redeemed ${points} loyalty points`],
    );
    return { points, usd };
  });
}
