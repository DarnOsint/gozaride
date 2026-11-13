import bcrypt from "bcryptjs";
import { queryOne, withTx } from "@/lib/db";
import { ok, fail, parseBody, serverError, isResponse } from "@/lib/http";
import { resetPasswordSchema } from "@/lib/validation";
import { clientIp, hitLimit } from "@/lib/rateLimit";
import { isUsableIdentifier, normalizeIdentifier } from "@/lib/identity";
import { findByIdentifier } from "@/lib/users";
import { hashResetCode } from "@/lib/passwordReset";

export async function POST(req: Request) {
  const body = await parseBody(req, resetPasswordSchema);
  if (isResponse(body)) return body;

  if (!isUsableIdentifier(body.identifier)) {
    return fail(422, "Enter the email address or phone number on your account");
  }
  const identifier = normalizeIdentifier(body.identifier);

  // 10 attempts per IP+identifier per 15 minutes.
  if (!hitLimit(`reset:${clientIp(req)}:${identifier}`, 10, 15 * 60 * 1000)) {
    return fail(429, "Too many attempts. Try again in 15 minutes.");
  }

  try {
    const user = await findByIdentifier(identifier);
    if (!user || !user.is_active) {
      return fail(400, "That reset code is invalid or has expired");
    }

    const token = await queryOne<{ id: string }>(
      `SELECT id FROM password_reset_tokens
        WHERE user_id = $1
          AND token_hash = $2
          AND used_at IS NULL
          AND expires_at > now()`,
      [user.id, hashResetCode(body.code)],
    );
    if (!token) return fail(400, "That reset code is invalid or has expired");

    const passwordHash = await bcrypt.hash(body.password, 12);
    await withTx(async (db) => {
      await db.query(
        "UPDATE users SET password_hash = $2, password_changed_at = now() WHERE id = $1",
        [user.id, passwordHash],
      );
      await db.query("UPDATE password_reset_tokens SET used_at = now() WHERE id = $1", [
        token.id,
      ]);
      // A reset invalidates every other outstanding code for this account.
      await db.query(
        "DELETE FROM password_reset_tokens WHERE user_id = $1 AND id <> $2",
        [user.id, token.id],
      );
    });

    return ok({ message: "Password updated. You can sign in now." });
  } catch (err) {
    return serverError("reset-password", err);
  }
}
