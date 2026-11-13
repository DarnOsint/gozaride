import bcrypt from "bcryptjs";
import { withTx } from "@/lib/db";
import { parseBody, fail, ok, serverError, isResponse } from "@/lib/http";
import { signToken } from "@/lib/auth";
import { signUpSchema } from "@/lib/validation";
import { clientIp, hitLimit } from "@/lib/rateLimit";
import { normalizeEmail, normalizePhone } from "@/lib/identity";
import {
  awardPoints,
  newReferralCode,
  REFERRAL_BONUS_POINTS,
  REFERRAL_REWARD_USD,
} from "@/lib/loyalty";
import { notify } from "@/lib/push";

function signupLimit(): number {
  return Number(process.env.SIGNUP_LIMIT_PER_HOUR ?? 10);
}

export async function POST(req: Request) {
  if (!hitLimit(`signup:${clientIp(req)}`, signupLimit(), 60 * 60 * 1000)) {
    return fail(429, "Too many sign-up attempts. Try again later.");
  }
  const body = await parseBody(req, signUpSchema);
  if (isResponse(body)) return body;

  try {
    const passwordHash = await bcrypt.hash(body.password, 12);
    const email = body.email ? normalizeEmail(body.email) : null;
    const phone = body.phone ? normalizePhone(body.phone) : null;
    const user = await withTx(async (db) => {
      if (email) {
        const dup = await db.query("SELECT 1 FROM users WHERE email = $1", [email]);
        if (dup.rowCount) return { conflict: "email" as const };
      }
      if (phone) {
        const dup = await db.query(
          `SELECT 1 FROM users
            WHERE phone IS NOT NULL
              AND right(regexp_replace(phone, '\\D', '', 'g'), 9) = right($1, 9)`,
          [phone],
        );
        if (dup.rowCount) return { conflict: "phone" as const };
      }

      const code = newReferralCode();
      const inserted = await db.query<{
        id: string;
        email: string | null;
        phone: string | null;
        full_name: string;
        role: string;
        default_currency: string;
      }>(
        `INSERT INTO users (email, password_hash, full_name, phone, role, referral_code)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, phone, full_name, role, default_currency`,
        [email, passwordHash, body.full_name, phone, body.role, code],
      );
      const u = inserted.rows[0];
      await db.query("INSERT INTO wallets (user_id) VALUES ($1)", [u.id]);
      if (u.role === "driver") {
        await db.query("INSERT INTO driver_profiles (user_id) VALUES ($1)", [u.id]);
      }
      if (u.role === "shop") {
        await db.query(
          "INSERT INTO shop_profiles (user_id, shop_name) VALUES ($1, $2)",
          [u.id, body.shop_name ?? body.full_name],
        );
      }

      // Process a referral, if one was supplied and it matches a real user.
      if (body.referral_code) {
        const referrer = await db.query<{ id: string }>(
          "SELECT id FROM users WHERE referral_code = $1 AND is_active",
          [body.referral_code],
        );
        if (referrer.rowCount) {
          const referrerId = referrer.rows[0].id;
          await db.query("UPDATE users SET referred_by = $2 WHERE id = $1", [u.id, referrerId]);
          await db.query(
            `INSERT INTO referrals (referrer_id, referee_id, reward_usd, points)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (referee_id) DO NOTHING`,
            [referrerId, u.id, REFERRAL_REWARD_USD, REFERRAL_BONUS_POINTS],
          );
          // Reward the referrer with cash + points, and welcome the new user with points.
          await db.query(
            `INSERT INTO transactions (user_id, type, amount_ssp, amount_usd, currency_used, status, description)
             VALUES ($1, 'bonus', 0, $2, 'usd', 'completed', 'Referral reward')`,
            [referrerId, REFERRAL_REWARD_USD],
          );
          await db.query(`UPDATE wallets SET usd_balance = usd_balance + $2 WHERE user_id = $1`, [
            referrerId,
            REFERRAL_REWARD_USD,
          ]);
          await awardPoints(db, referrerId, REFERRAL_BONUS_POINTS, "referral", u.id);
          await awardPoints(db, u.id, REFERRAL_BONUS_POINTS, "referral_welcome", referrerId);
        }
      }
      return u;
    });

    if ("conflict" in user) {
      return fail(
        409,
        user.conflict === "email"
          ? "An account with this email already exists"
          : "An account with this phone number already exists",
      );
    }

    const token = signToken(user.id, user.role as "customer" | "driver" | "shop");
    // Fire-and-forget welcome notification (never blocks signup on failure).
    await notify(user.id, {
      title: "Welcome to Gozaride",
      body: "Your account is ready. Your referral code is on your loyalty page.",
      kind: "welcome",
    });
    return ok({ token, user }, 201);
  } catch (err) {
    return serverError("signup", err);
  }
}
