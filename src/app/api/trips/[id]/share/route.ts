import { query, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { fail, ok, serverError, isResponse } from "@/lib/http";
import { getTrip, canSeeTrip } from "@/lib/trips";
import { newShareToken, SHARE_TTL_HOURS } from "@/lib/safety";

/** Create (or refresh) a read-only share link for a trip. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req, ["customer", "driver", "admin"]);
  if (isResponse(session)) return session;

  const { id } = await ctx.params;
  try {
    const trip = await getTrip(id);
    if (!trip) return fail(404, "Trip not found");
    if (!canSeeTrip(trip, session)) return fail(403, "You cannot share this trip");

    const token = newShareToken();
    const share = await queryOne<{ token: string; expires_at: string }>(
      `INSERT INTO trip_shares (token, trip_id, created_by, expires_at)
       VALUES ($1, $2, $3, now() + ($4 || ' hours')::interval)
       RETURNING token, expires_at`,
      [token, id, session.id, String(SHARE_TTL_HOURS)],
    );
    return ok({ share }, 201);
  } catch (err) {
    return serverError("trip share", err);
  }
}

/** Revoke every share link for a trip. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req, ["customer", "driver", "admin"]);
  if (isResponse(session)) return session;

  const { id } = await ctx.params;
  try {
    const trip = await getTrip(id);
    if (!trip) return fail(404, "Trip not found");
    if (!canSeeTrip(trip, session)) return fail(403, "You cannot share this trip");

    await query(`DELETE FROM trip_shares WHERE trip_id = $1`, [id]);
    return ok({ revoked: true });
  } catch (err) {
    return serverError("trip share", err);
  }
}
