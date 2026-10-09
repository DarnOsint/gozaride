import type { PoolClient } from "pg";
import { withTx } from "./db";
import { getTrip } from "./trips";

export type Result<T = void> =
  | { ok: true; value: T }
  | { ok: false; status: number; message: string };

const good = <T>(value: T): Result<T> => ({ ok: true, value });
const bad = (status: number, message: string): { ok: false; status: number; message: string } => ({
  ok: false,
  status,
  message,
});

/** Driver accepts a pending trip. Serialised per driver so one driver cannot hold two trips. */
export async function acceptTrip(tripId: string, driverId: string): Promise<Result<string>> {
  return withTx(async (db: PoolClient) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [driverId]);

    const driver = await db.query<{ is_online: boolean }>(
      "SELECT is_online FROM driver_profiles WHERE user_id = $1",
      [driverId],
    );
    if (!driver.rows[0]?.is_online) return bad(409, "Go online before accepting trips");

    const busy = await db.query(
      "SELECT 1 FROM trips WHERE driver_id = $1 AND status IN ('accepted', 'in_progress') LIMIT 1",
      [driverId],
    );
    if (busy.rowCount) return bad(409, "Finish your current trip first");

    const trip = await db.query<{ status: string }>("SELECT status FROM trips WHERE id = $1", [tripId]);
    if (!trip.rows[0]) return bad(404, "Trip not found");

    const updated = await db.query(
      `UPDATE trips
          SET driver_id = $2, status = 'accepted', accepted_at = now()
        WHERE id = $1 AND status = 'pending' AND driver_id IS NULL
        RETURNING id`,
      [tripId, driverId],
    );
    if (!updated.rowCount) return bad(409, "This trip was already taken");
    return good(tripId);
  });
}

/** Generic guarded transition. The WHERE clause enforces who may move the trip from which state. */
async function guardedUpdate(
  tripId: string,
  sql: string,
  params: unknown[],
  notAllowedMessage: string,
): Promise<Result<string>> {
  return withTx(async (db) => {
    const exists = await db.query("SELECT 1 FROM trips WHERE id = $1", [tripId]);
    if (!exists.rowCount) return bad(404, "Trip not found");
    const res = await db.query(sql, params);
    if (!res.rowCount) return bad(409, notAllowedMessage);
    return good(tripId);
  });
}

export function startTrip(tripId: string, driverId: string) {
  return guardedUpdate(
    tripId,
    `UPDATE trips SET status = 'in_progress', started_at = now()
      WHERE id = $1 AND driver_id = $2 AND status = 'accepted'
      RETURNING id`,
    [tripId, driverId],
    "This trip cannot be started right now",
  );
}

export function completeTrip(tripId: string, driverId: string) {
  return guardedUpdate(
    tripId,
    `UPDATE trips SET status = 'completed', completed_at = now()
      WHERE id = $1 AND driver_id = $2 AND status = 'in_progress'
      RETURNING id`,
    [tripId, driverId],
    "This trip is not in progress",
  );
}

/** Customers may cancel before the trip starts. Drivers may cancel an accepted trip. */
export function cancelTrip(
  tripId: string,
  actor: { id: string; role: "customer" | "driver" },
  reason: string | undefined,
) {
  if (actor.role === "customer") {
    return guardedUpdate(
      tripId,
      `UPDATE trips SET status = 'cancelled', cancelled_at = now(), cancel_reason = $3
        WHERE id = $1 AND customer_id = $2 AND status IN ('pending', 'accepted')
        RETURNING id`,
      [tripId, actor.id, reason ?? null],
      "This trip can no longer be cancelled",
    );
  }
  return guardedUpdate(
    tripId,
    `UPDATE trips SET status = 'cancelled', cancelled_at = now(), cancel_reason = $3
      WHERE id = $1 AND driver_id = $2 AND status = 'accepted'
      RETURNING id`,
    [tripId, actor.id, reason ?? null],
    "This trip can no longer be cancelled by the driver",
  );
}

/** Store a rating after completion. Driver averages are recalculated from the ratings table. */
export async function rateTrip(
  tripId: string,
  rater: { id: string; role: "customer" | "driver" },
  stars: number,
  comment: string | undefined,
): Promise<Result<{ ratee_id: string }>> {
  const trip = await getTrip(tripId);
  if (!trip) return bad(404, "Trip not found");
  if (trip.status !== "completed") return bad(409, "You can rate a trip only after it is completed");

  const isCustomer = rater.role === "customer" && trip.customer_id === rater.id;
  const isDriver = rater.role === "driver" && trip.driver_id === rater.id;
  if (!isCustomer && !isDriver) return bad(403, "You were not part of this trip");

  const rateeId = isCustomer ? trip.driver_id! : trip.customer_id;

  return withTx(async (db) => {
    try {
      await db.query(
        `INSERT INTO ratings (trip_id, rater_id, ratee_id, stars, comment)
         VALUES ($1, $2, $3, $4, $5)`,
        [tripId, rater.id, rateeId, stars, comment ?? null],
      );
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        return bad(409, "You have already rated this trip");
      }
      throw err;
    }
    if (isCustomer) {
      await db.query(
        `UPDATE driver_profiles d
            SET rating_avg = s.avg, rating_count = s.cnt
           FROM (SELECT ROUND(AVG(stars)::numeric, 2) AS avg, COUNT(*)::int AS cnt
                   FROM ratings WHERE ratee_id = $1) s
          WHERE d.user_id = $1`,
        [rateeId],
      );
    }
    return good({ ratee_id: rateeId });
  });
}
