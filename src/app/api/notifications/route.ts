import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, serverError, isResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

const MAX = 50;

/** List the signed-in user's notifications with an unread count. */
export async function GET(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;

  try {
    const rows = await query(
      `SELECT id, title, body, kind, data, read_at, created_at
         FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [session.id, MAX],
    );
    const unread = rows.filter((r) => !(r as { read_at: string | null }).read_at).length;
    return ok({ notifications: rows, unread });
  } catch (err) {
    return serverError("notifications list", err);
  }
}
