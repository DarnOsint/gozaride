import { query, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseBody, ok, serverError, isResponse } from "@/lib/http";
import { locationSchema } from "@/lib/validation";

/**
 * Driver: report GPS position. Updates the driver's last known location and,
 * if a trip is in progress, appends a point to that trip's track.
 */
export async function POST(req: Request) {
  const session = await requireSession(req, ["driver"]);
  if (isResponse(session)) return session;

  const body = await parseBody(req, locationSchema);
  if (isResponse(body)) return body;

  try {
    await query(
      `INSERT INTO driver_profiles (user_id, latitude, longitude, location_updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id) DO UPDATE
         SET latitude = EXCLUDED.latitude,
             longitude = EXCLUDED.longitude,
             location_updated_at = now()`,
      [session.id, body.latitude, body.longitude],
    );

    const active = await queryOne<{ id: string }>(
      `SELECT id FROM trips WHERE driver_id = $1 AND status = 'in_progress' LIMIT 1`,
      [session.id],
    );
    if (active) {
      await query(
        `INSERT INTO trip_locations (trip_id, driver_id, latitude, longitude)
         VALUES ($1, $2, $3, $4)`,
        [active.id, session.id, body.latitude, body.longitude],
      );
    }
    return ok({ recorded: true, trip_id: active?.id ?? null });
  } catch (err) {
    return serverError("driver location", err);
  }
}
