import bcrypt from "bcryptjs";
import { query, queryOne } from "@/lib/db";
import { parseBody, fail, ok, serverError, isResponse } from "@/lib/http";
import { signToken } from "@/lib/auth";
import { signInSchema } from "@/lib/validation";
import { clientIp, hitLimit } from "@/lib/rateLimit";

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: "customer" | "driver" | "shop" | "admin";
  default_currency: string;
  password_hash: string;
  is_active: boolean;
};

export async function POST(req: Request) {
  const body = await parseBody(req, signInSchema);
  if (isResponse(body)) return body;

  // 10 attempts per IP+email per 15 minutes.
  if (!hitLimit(`signin:${clientIp(req)}:${body.email}`, 10, 15 * 60 * 1000)) {
    return fail(429, "Too many sign-in attempts. Try again in 15 minutes.");
  }

  try {
    const user = await queryOne<UserRow>(
      `SELECT id, email, full_name, role, default_currency, password_hash, is_active
         FROM users WHERE email = $1`,
      [body.email],
    );
    // Compare even when the user is missing, so timing does not reveal accounts.
    const hash = user?.password_hash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
    const valid = await bcrypt.compare(body.password, hash);
    if (!user || !valid || !user.is_active) {
      return fail(401, "Email or password is incorrect");
    }

    await query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
    const token = signToken(user.id, user.role);
    const { password_hash: _ignored, is_active: _active, ...publicUser } = user;
    void _ignored;
    void _active;
    return ok({ token, user: publicUser });
  } catch (err) {
    return serverError("signin", err);
  }
}
