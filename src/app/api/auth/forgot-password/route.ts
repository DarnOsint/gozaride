import { ok, fail, parseBody, serverError, isResponse } from "@/lib/http";
import { forgotPasswordSchema } from "@/lib/validation";
import { clientIp, hitLimit } from "@/lib/rateLimit";
import { isEmailIdentifier, isUsableIdentifier, normalizeIdentifier } from "@/lib/identity";
import { findByIdentifier } from "@/lib/users";
import {
  canRevealResetCode,
  sendMail,
  sendSms,
} from "@/lib/delivery";
import {
  issueResetCode,
  resetEmailHtml,
  resetEmailText,
  resetSmsText,
} from "@/lib/passwordReset";

const GENERIC =
  "If an account matches, we sent a reset code to that email address or phone number.";

export async function POST(req: Request) {
  const body = await parseBody(req, forgotPasswordSchema);
  if (isResponse(body)) return body;

  const identifier = normalizeIdentifier(body.identifier);
  if (!isUsableIdentifier(body.identifier)) {
    return fail(422, "Enter the email address or phone number on your account");
  }

  // 5 reset requests per IP+identifier per hour.
  if (!hitLimit(`forgot:${clientIp(req)}:${identifier}`, 5, 60 * 60 * 1000)) {
    return fail(429, "Too many reset requests. Try again in an hour.");
  }

  try {
    const user = await findByIdentifier(identifier);
    // Always answer the same way so the endpoint cannot be used to find accounts.
    if (!user || !user.is_active) return ok({ message: GENERIC });

    const channel = isEmailIdentifier(identifier) ? "email" : "sms";
    const code = await issueResetCode(user.id, channel);

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(
      /\/$/,
      "",
    );
    const link = `${appUrl}/reset-password?identifier=${encodeURIComponent(identifier)}&code=${encodeURIComponent(code)}`;

    const delivered =
      channel === "email"
        ? Boolean(
            user.email &&
              (await sendMail({
                to: user.email,
                subject: "Your Gozaride password reset code",
                text: resetEmailText(code, link),
                html: resetEmailHtml(code, link),
              })),
          )
        : Boolean(user.phone && (await sendSms(user.phone, resetSmsText(code))));

    const payload: { message: string; dev_code?: string } = { message: GENERIC };
    if (!delivered && canRevealResetCode()) payload.dev_code = code;
    return ok(payload);
  } catch (err) {
    return serverError("forgot-password", err);
  }
}
