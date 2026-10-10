import webpush from "web-push";
import { query, queryOne } from "./db";

let vapidReady = false;

function publicKey(): string | undefined {
  return process.env.VAPID_PUBLIC_KEY || undefined;
}
function privateKey(): string | undefined {
  return process.env.VAPID_PRIVATE_KEY || undefined;
}
function subject(): string {
  return process.env.VAPID_SUBJECT || "mailto:admin@gozaride.com";
}

/** Web Push is optional: enabled only when a VAPID key pair is configured. */
export function pushEnabled(): boolean {
  return Boolean(publicKey() && privateKey());
}

function configure() {
  if (!vapidReady && pushEnabled()) {
    webpush.setVapidDetails(subject(), publicKey()!, privateKey()!);
    vapidReady = true;
  }
}

export type NotifyInput = {
  title: string;
  body?: string;
  kind?: string;
  data?: Record<string, unknown>;
};

/**
 * Create an in-app notification for a user and, when push is configured and
 * the user has subscriptions, deliver a Web Push message. Push failures never
 * throw — a dead subscription is pruned and the call still succeeds.
 */
export async function notify(userId: string, input: NotifyInput): Promise<void> {
  const { title, body = null, kind = "info", data = {} } = input;

  try {
    await query(
      `INSERT INTO notifications (user_id, title, body, kind, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, title, body, kind, JSON.stringify(data)],
    );
  } catch (err) {
    console.error("[notify] store failed", err);
    return;
  }

  if (!pushEnabled()) return;

  try {
    configure();

    const subs = await query<{ endpoint: string; p256dh: string; auth: string }>(
      `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
      [userId],
    );
    if (subs.length === 0) return;

    const payload = JSON.stringify({ title, body, kind, data });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          // 404/410: the subscription is gone for good; remove it.
          if (status === 404 || status === 410) {
            await query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [s.endpoint]);
          } else {
            console.error("[push] delivery failed", status ?? err);
          }
        }
      }),
    );
  } catch (err) {
    console.error("[push] send failed", err);
  }
}

/** Convenience lookup used by route handlers that only have a trip id. */
export async function notifyTripCustomer(
  tripId: string,
  input: NotifyInput,
): Promise<void> {
  const row = await queryOne<{ customer_id: string }>(
    `SELECT customer_id FROM trips WHERE id = $1`,
    [tripId],
  );
  if (row) await notify(row.customer_id, input);
}
