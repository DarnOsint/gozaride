import { query, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { fail, ok, serverError, isResponse } from "@/lib/http";
import { TRIP_COLUMNS } from "@/lib/trips";
import { distanceKm } from "@/lib/geo";

const PICKUP_RADIUS_KM = 10;

/** Driver: open trip requests. Sorted by distance to the driver when their location is known. */
export async function GET(req: Request) {
  const session = await requireSession(req, ["driver"]);
  if (isResponse(session)) return session;

  try {
    const driver = await queryOne<{
      is_online: boolean;
      latitude: number | null;
      longitude: number | null;
    }>(
      `SELECT is_online, latitude, longitude FROM driver_profiles WHERE user_id = $1`,
      [session.id],
    );
    if (!driver?.is_online) return fail(409, "Go online to see trip requests");

    const rows = await query<{ origin_lat: number; origin_lng: number } & Record<string, unknown>>(
      `SELECT ${TRIP_COLUMNS} FROM trips t
        WHERE t.status = 'pending'
        ORDER BY t.requested_at ASC
        LIMIT 100`,
    );

    const hasLocation = driver.latitude !== null && driver.longitude !== null;
    const trips = rows
      .map((t) => {
        const pickupKm = hasLocation
          ? Math.round(
              distanceKm(
                { lat: driver.latitude!, lng: driver.longitude! },
                { lat: t.origin_lat, lng: t.origin_lng },
              ) * 100,
            ) / 100
          : null;
        return { ...t, pickup_distance_km: pickupKm };
      })
      .filter((t) => t.pickup_distance_km === null || t.pickup_distance_km <= PICKUP_RADIUS_KM)
      .sort((a, b) => (a.pickup_distance_km ?? 0) - (b.pickup_distance_km ?? 0));

    return ok({ trips });
  } catch (err) {
    return serverError("available trips", err);
  }
}
