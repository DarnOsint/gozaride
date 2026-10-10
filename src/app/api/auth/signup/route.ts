import bcrypt from "bcryptjs";
import { withTx } from "@/lib/db";
import { parseBody, fail, ok, serverError, isResponse } from "@/lib/http";
import { signToken } from "@/lib/auth";
import { signUpSchema } from "@/lib/validation";
import { clientIp, hitLimit } from "@/lib/rateLimit";

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
    const user = await withTx(async (db) => {
      const dup = await db.query("SELECT 1 FROM users WHERE email = $1", [body.email]);
      if (dup.rowCount) return null;

      const inserted = await db.query<{
        id: string;
        email: string;
        full_name: string;
        role: string;
        default_currency: string;
      }>(
        `INSERT INTO users (email, password_hash, full_name, phone, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, full_name, role, default_currency`,
        [body.email, passwordHash, body.full_name, body.phone ?? null, body.role],
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
      return u;
    });

    if (!user) return fail(409, "An account with this email already exists");

    const token = signToken(user.id, user.role as "customer" | "driver" | "shop");
    return ok({ token, user }, 201);
  } catch (err) {
    return serverError("signup", err);
  }
}
