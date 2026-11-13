/**
 * Reset delivery. Both providers are optional: when credentials are missing the
 * message is not sent, and outside production (or with RESET_LOG_CODES=true)
 * the code is returned to the caller so local testing still works.
 *
 * Email: Resend (RESEND_API_KEY, MAIL_FROM)
 * SMS:   Africa's Talking (AFRICASTALKING_USERNAME, AFRICASTALKING_API_KEY,
 *        optional AFRICASTALKING_SENDER_ID, AFRICASTALKING_SANDBOX=true)
 */

export function canRevealResetCode(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.RESET_LOG_CODES === "true";
}

function logFallback(label: string, to: string, text: string) {
  if (canRevealResetCode()) {
    console.warn(`[${label}] no provider configured; code for ${to}:\n${text}`);
  } else {
    console.error(`[${label}] no provider configured; reset message was not delivered`);
  }
}

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from) {
    logFallback("mail", input.to, input.text);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[mail] Resend rejected the message:", res.status, detail);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[mail] send failed:", err);
    return false;
  }
}

export async function sendSms(to: string, message: string): Promise<boolean> {
  const username = process.env.AFRICASTALKING_USERNAME;
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  if (!username || !apiKey) {
    logFallback("sms", to, message);
    return false;
  }
  const host =
    process.env.AFRICASTALKING_SANDBOX === "true"
      ? "https://api.sandbox.africastalking.com"
      : "https://api.africastalking.com";
  const form = new URLSearchParams({ username, to, message });
  if (process.env.AFRICASTALKING_SENDER_ID) {
    form.set("from", process.env.AFRICASTALKING_SENDER_ID);
  }
  try {
    const res = await fetch(`${host}/version1/messaging`, {
      method: "POST",
      headers: {
        apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: form.toString(),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[sms] Africa's Talking rejected the message:", res.status, detail);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[sms] send failed:", err);
    return false;
  }
}
