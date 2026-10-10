import { ok } from "@/lib/http";
import { pushEnabled } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * Expose the VAPID public key so the browser can create a push subscription.
 * The key is public by design. When push is not configured, `enabled` is false
 * and the client simply skips subscribing (in-app notifications still work).
 */
export async function GET() {
  return ok({
    enabled: pushEnabled(),
    publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
  });
}
