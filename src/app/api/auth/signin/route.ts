import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { parseBody, fail, ok, serverError, isResponse } from "@/lib/http";
import { signToken } from "@/lib/auth";
import { signInSchema } from "@/lib/validation";
import { clientIp, hitLimit } from "@/lib/rateLimit";
import { normalizeIdentifier } from "@/lib/identity";
import { findByIdentifier } from "@/lib/users";

export async function POST(req: Request) {
  const body = await parseBody(req, signInSchema);
  if (isResponse(body)) return body;

  const identifier = normalizeIdentifier(body.identifier);
  if (!identifier) return fail(422, "Enter your email or phone number");

  // 10 attempts per IP+identifier per 15 minutes.
  if (!hitLimit(`signin:${clientIp(req)}:${identifier}`, 10, 15 * 60 * 1000)) {
    return fail(429, "Too many sign-in attempts. Try again in 15 minutes.");
  }

  try {
    const user = await findByIdentifier(identifier);
    // Compare even when the user is missing, so timing does not reveal accounts.
    const hash = user?.password_hash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
    const valid = await bcrypt.compare(body.password, hash);
    if (!user || !valid || !user.is_active) {
      return fail(401, "Email, phone or password is incorrect");
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
