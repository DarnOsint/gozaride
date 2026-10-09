/**
 * Shared SELECT list for trips. Every numeric column is cast to float8 so
 * pg returns JSON numbers instead of strings.
 */
export const TRIP_COLUMNS = `
  t.id,
  t.customer_id,
  t.driver_id,
  t.service_type,
  t.status,
  t.origin_name,
  t.origin_lat::float8 AS origin_lat,
  t.origin_lng::float8 AS origin_lng,
  t.dest_name,
  t.dest_lat::float8 AS dest_lat,
  t.dest_lng::float8 AS dest_lng,
  t.distance_km::float8 AS distance_km,
  t.eta_minutes,
  t.fare_usd::float8 AS fare_usd,
  t.exchange_rate_ssp_per_usd::float8 AS exchange_rate_ssp_per_usd,
  round(t.fare_usd * t.exchange_rate_ssp_per_usd, 2)::float8 AS fare_ssp,
  t.commission_rate::float8 AS commission_rate,
  round(t.fare_usd * (1 - t.commission_rate), 2)::float8 AS driver_earnings_usd,
  t.requested_at,
  t.accepted_at,
  t.started_at,
  t.completed_at,
  t.cancelled_at,
  t.cancel_reason
`;

export const ACTIVE_STATUSES = ["pending", "accepted", "in_progress"] as const;

import { queryOne, type QueryResultRow } from "./db";

export type TripRow = QueryResultRow & {
  id: string;
  customer_id: string;
  driver_id: string | null;
  status: "pending" | "accepted" | "in_progress" | "completed" | "cancelled";
  service_type: string;
};

export async function getTrip(id: string): Promise<TripRow | null> {
  return queryOne<TripRow>(`SELECT ${TRIP_COLUMNS} FROM trips t WHERE t.id = $1`, [id]);
}

/** A trip is visible to its customer, its assigned driver, and admins. */
export function canSeeTrip(
  trip: { customer_id: string; driver_id: string | null },
  session: { id: string; role: string },
): boolean {
  if (session.role === "admin") return true;
  if (session.role === "customer") return trip.customer_id === session.id;
  if (session.role === "driver") return trip.driver_id === session.id;
  return false;
}
