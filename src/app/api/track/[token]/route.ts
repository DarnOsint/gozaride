import { queryOne } from "@/lib/db";
import { ok, fail, serverError } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Public, token-gated read-only trip view for a trusted contact. Exposes only
 * trip status, pickup/destination and the driver's latest position — never
 * contact details or account information.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    const share = await queryOne<{ trip_id: string; expires_at: string }>(
      `SELECT trip_id, expires_at FROM trip_shares WHERE token = $1 AND expires_at > now()`,
      [token],
    );
    if (!share) return fail(404, "This tracking link is invalid or has expired");

    const trip = await queryOne<{
      status: string;
      service_type: string;
      origin_name: string | null;
      origin_lat: number;
      origin_lng: number;
      dest_name: string | null;
      dest_lat: number;
      dest_lng: number;
      eta_minutes: number;
    }>(
      `SELECT status, service_type, origin_name, origin_lat::float8 AS origin_lat,
              origin_lng::float8 AS origin_lng, dest_name, dest_lat::float8 AS dest_lat,
              dest_lng::float8 AS dest_lng, eta_minutes
         FROM trips WHERE id = $1`,
      [share.trip_id],
    );
    if (!trip) return fail(404, "Trip not found");

    const last = await queryOne<{ latitude: number; longitude: number; recorded_at: string }>(
      `SELECT latitude::float8 AS latitude, longitude::float8 AS longitude, recorded_at
         FROM trip_locations WHERE trip_id = $1
        ORDER BY recorded_at DESC LIMIT 1`,
      [share.trip_id],
    );

    return ok({
      status: trip.status,
      service_type: trip.service_type,
      origin: { lat: trip.origin_lat, lng: trip.origin_lng, name: trip.origin_name },
      destination: { lat: trip.dest_lat, lng: trip.dest_lng, name: trip.dest_name },
      eta_minutes: trip.eta_minutes,
      driver_location: last ?? null,
      expires_at: share.expires_at,
    });
  } catch (err) {
    return serverError("public track", err);
  }
}
