import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseBody, ok, serverError, isResponse } from "@/lib/http";
import { pushSubscribeSchema } from "@/lib/validation";

/**
 * Register (or refresh) a Web Push subscription for the current device.
 * Upserts on the endpoint so re-subscribing the same browser is idempotent.
 */
export async function POST(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;

  const body = await parseBody(req, pushSubscribeSchema);
  if (isResponse(body)) return body;

  try {
    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [session.id, body.endpoint, body.keys.p256dh, body.keys.auth],
    );
    return ok({ subscribed: true }, 201);
  } catch (err) {
    return serverError("push subscribe", err);
  }
}

/** Remove a subscription for the current device. */
export async function DELETE(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;

  const body = await parseBody(req, pushSubscribeSchema.pick({ endpoint: true }));
  if (isResponse(body)) return body;

  try {
    await query(`DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2`, [
      body.endpoint,
      session.id,
    ]);
    return ok({ unsubscribed: true });
  } catch (err) {
    return serverError("push unsubscribe", err);
  }
}
