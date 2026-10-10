import { query, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseBody, fail, ok, serverError, isResponse } from "@/lib/http";
import { tripRequestSchema } from "@/lib/validation";
import { currentRate } from "@/lib/rates";
import { distanceKm, etaMinutes } from "@/lib/geo";
import { COMMISSION_RATE, fareUsd } from "@/lib/pricing";
import { ACTIVE_STATUSES, TRIP_COLUMNS, getTrip } from "@/lib/trips";

/** Customer: request a trip. The fare is priced now and locked for the trip. */
export async function POST(req: Request) {
  const session = await requireSession(req, ["customer"]);
  if (isResponse(session)) return session;

  const body = await parseBody(req, tripRequestSchema);
  if (isResponse(body)) return body;

  try {
    const rate = await currentRate();
    if (!rate) {
      return fail(503, "Trips are unavailable until an admin sets the exchange rate");
    }

    const km = distanceKm(
      { lat: body.origin.lat, lng: body.origin.lng },
      { lat: body.destination.lat, lng: body.destination.lng },
    );
    if (km < 0.05) {
      return fail(422, "Pickup and destination are the same place");
    }

    const busy = await queryOne(
      `SELECT id FROM trips WHERE customer_id = $1 AND status = ANY($2::text[]) LIMIT 1`,
      [session.id, ACTIVE_STATUSES],
    );
    if (busy) {
      return fail(409, "You already have an active trip");
    }

    const inserted = await queryOne<{ id: string }>(
      `INSERT INTO trips (
         customer_id, service_type,
         origin_name, origin_lat, origin_lng,
         dest_name, dest_lat, dest_lng,
         distance_km, eta_minutes, fare_usd,
         exchange_rate_ssp_per_usd, commission_rate
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [
        session.id,
        body.service_type,
        body.origin.name ?? null,
        body.origin.lat,
        body.origin.lng,
        body.destination.name ?? null,
        body.destination.lat,
        body.destination.lng,
        Math.round(km * 100) / 100,
        etaMinutes(km),
        fareUsd(body.service_type, km),
        rate.ssp_per_usd,
        COMMISSION_RATE,
      ],
    );
    const trip = await getTrip(inserted!.id);
    return ok({ trip }, 201);
  } catch (err) {
    return serverError("request trip", err);
  }
}

/** List trips: customers see their own, drivers their assigned trips, admins all. */
export async function GET(req: Request) {
  const session = await requireSession(req, ["customer", "driver", "admin"]);
  if (isResponse(session)) return session;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const limitRaw = Number(url.searchParams.get("limit") ?? 20);
  const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;

  const where: string[] = [];
  const params: unknown[] = [];
  if (session.role === "customer") {
    params.push(session.id);
    where.push(`t.customer_id = $${params.length}`);
  } else if (session.role === "driver") {
    params.push(session.id);
    where.push(`t.driver_id = $${params.length}`);
  }
  if (status) {
    // Accepts one status or a comma-separated list, e.g. "accepted,in_progress".
    const allowed = ["pending", "accepted", "in_progress", "completed", "cancelled"];
    const wanted = status.split(",").map((s) => s.trim()).filter(Boolean);
    if (wanted.length === 0 || wanted.some((s) => !allowed.includes(s))) {
      return fail(422, "Unknown trip status");
    }
    params.push(wanted);
    where.push(`t.status = ANY($${params.length}::text[])`);
  }
  params.push(limit);

  try {
    const rows = await query(
      `SELECT ${TRIP_COLUMNS} FROM trips t
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY t.requested_at DESC
        LIMIT $${params.length}`,
      params,
    );
    return ok({ trips: rows });
  } catch (err) {
    return serverError("list trips", err);
  }
}
