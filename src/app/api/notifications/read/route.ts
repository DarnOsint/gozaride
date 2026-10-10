import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseBody, ok, serverError, isResponse } from "@/lib/http";
import { z } from "zod";

const schema = z.object({
  // Omit id to mark everything as read.
  id: z.string().uuid().optional(),
});

/** Mark one notification (or all when no id is given) as read. */
export async function POST(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;

  const body = await parseBody(req, schema);
  if (isResponse(body)) return body;

  try {
    if (body.id) {
      await query(
        `UPDATE notifications SET read_at = now()
          WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
        [body.id, session.id],
      );
    } else {
      await query(
        `UPDATE notifications SET read_at = now()
          WHERE user_id = $1 AND read_at IS NULL`,
        [session.id],
      );
    }
    return ok({ read: true });
  } catch (err) {
    return serverError("notifications read", err);
  }
}
