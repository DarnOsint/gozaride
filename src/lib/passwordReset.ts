import { createHash, randomInt } from "node:crypto";
import { query } from "./db";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const RESET_CODE_TTL_MINUTES = 20;

export function newResetCode(length = 8): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

export function hashResetCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

/** Creates a fresh code, invalidating expired/used ones for the same user. */
export async function issueResetCode(
  userId: string,
  channel: "email" | "sms",
): Promise<string> {
  const code = newResetCode();
  await query(
    `DELETE FROM password_reset_tokens
      WHERE user_id = $1 AND (used_at IS NOT NULL OR expires_at < now())`,
    [userId],
  );
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, channel, expires_at)
     VALUES ($1, $2, $3, now() + ($4 || ' minutes')::interval)`,
    [userId, hashResetCode(code), channel, String(RESET_CODE_TTL_MINUTES)],
  );
  return code;
}

export function resetEmailText(code: string, link: string): string {
  return [
    `Your Gozaride password reset code is ${code}.`,
    `It expires in ${RESET_CODE_TTL_MINUTES} minutes.`,
    "",
    `Choose a new password here: ${link}`,
    "",
    "If you did not ask to reset your password, you can ignore this email.",
  ].join("\n");
}

export function resetEmailHtml(code: string, link: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px">
  <h2 style="color:#ea580c;margin:0 0 12px">Reset your Gozaride password</h2>
  <p>Enter this code in the app:</p>
  <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p>
  <p>The code expires in ${RESET_CODE_TTL_MINUTES} minutes.</p>
  <p><a href="${link}" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none">Choose a new password</a></p>
  <p style="color:#6b7280;font-size:13px">If you did not ask to reset your password, you can ignore this email.</p>
</div>`;
}

export function resetSmsText(code: string): string {
  return `Gozaride: ${code} is your password reset code. It expires in ${RESET_CODE_TTL_MINUTES} minutes.`;
}
