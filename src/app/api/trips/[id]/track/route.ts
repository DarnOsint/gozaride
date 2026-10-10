import { queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, fail, serverError, isResponse } from "@/lib/http";
import { getTrip, canSeeTrip } from "@/lib/trips";

export const dynamic = "force-dynamic";

/**
 * Live tracking for a trip. Returns the trip's pickup/destination plus the
 * driver's most recent reported position. Visible to the customer, the
 * assigned driver, and admins. Designed to be polled every few seconds.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;

  const { id } = await ctx.params;
  try {
    const trip = await getTrip(id);
    if (!trip) return fail(404, "Trip not found");
    if (!canSeeTrip(trip, session)) return fail(403, "You cannot view this trip");

    const last = await queryOne<{ latitude: number; longitude: number; recorded_at: string }>(
      `SELECT latitude::float8 AS latitude, longitude::float8 AS longitude, recorded_at
         FROM trip_locations
        WHERE trip_id = $1
        ORDER BY recorded_at DESC
        LIMIT 1`,
      [id],
    );

    return ok({
      status: trip.status,
      driver_id: trip.driver_id,
      origin: { lat: trip.origin_lat, lng: trip.origin_lng, name: trip.origin_name },
      destination: { lat: trip.dest_lat, lng: trip.dest_lng, name: trip.dest_name },
      driver_location: last ?? null,
    });
  } catch (err) {
    return serverError("trip track", err);
  }
}