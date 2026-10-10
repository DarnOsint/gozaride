import type { PoolClient } from "pg";
import { withTx } from "./db";
import { getTrip } from "./trips";
import { notify } from "./push";
import { awardPoints, pointsForEarnings, pointsForFare } from "./loyalty";

export type Result<T = void> =
  | { ok: true; value: T }
  | { ok: false; status: number; message: string };

const good = <T>(value: T): Result<T> => ({ ok: true, value });
const bad = (status: number, message: string): { ok: false; status: number; message: string } => ({
  ok: false,
  status,
  message,
});

/** Notify a trip's participants after a state change. Never throws. */
async function notifyTrip(
  tripId: string,
  opts: { exclude?: string; title: string; body: string; kind: string },
): Promise<void> {
  try {
    const trip = await getTrip(tripId);
    if (!trip) return;
    const recipients = [trip.customer_id, trip.driver_id].filter(
      (id): id is string => Boolean(id) && id !== opts.exclude,
    );
    await Promise.all(
      recipients.map((id) =>
        notify(id, {
          title: opts.title,
          body: opts.body,
          kind: opts.kind,
          data: { trip_id: tripId },
        }),
      ),
    );
  } catch (err) {
    console.error("[notify] trip", err);
  }
}

/** Driver accepts a pending trip. Serialised per driver so one driver cannot hold two trips. */
export async function acceptTrip(tripId: string, driverId: string): Promise<Result<string>> {
  const res = await withTx(async (db: PoolClient) => {
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
  if (res.ok) {
    await notifyTrip(tripId, {
      exclude: driverId,
      title: "Driver on the way",
      body: "A driver accepted your request and is heading to the pickup point.",
      kind: "trip_update",
    });
  }
  return res;
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

export async function startTrip(tripId: string, driverId: string) {
  const res = await guardedUpdate(
    tripId,
    `UPDATE trips SET status = 'in_progress', started_at = now()
      WHERE id = $1 AND driver_id = $2 AND status = 'accepted'
      RETURNING id`,
    [tripId, driverId],
    "This trip cannot be started right now",
  );
  if (res.ok) {
    await notifyTrip(tripId, {
      exclude: driverId,
      title: "Trip started",
      body: "Your trip is now in progress. Track your driver live on the map.",
      kind: "trip_update",
    });
  }
  return res;
}

/** Complete a trip and record the driver's net earnings (fare minus platform commission). */
export async function completeTrip(tripId: string, driverId: string): Promise<Result<string>> {
  const res = await withTx(async (db) => {
    const done = await db.query(
      `UPDATE trips SET status = 'completed', completed_at = now()
        WHERE id = $1 AND driver_id = $2 AND status = 'in_progress'
        RETURNING id, customer_id, fare_usd::float8 AS fare_usd,
                  exchange_rate_ssp_per_usd::float8 AS rate,
                  commission_rate::float8 AS commission`,
      [tripId, driverId],
    );
    const trip = done.rows[0];
    if (!trip) return bad(409, "This trip is not in progress");

    const netUsd = Math.round(trip.fare_usd * (1 - trip.commission) * 100) / 100;
    const netSsp = Math.round(netUsd * trip.rate * 100) / 100;
    await db.query(
      `INSERT INTO earnings_history (driver_id, trip_id, net_earnings_ssp, net_earnings_usd)
       VALUES ($1, $2, $3, $4)`,
      [driverId, tripId, netSsp, netUsd],
    );
    await db.query(
      `INSERT INTO wallets (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
      [driverId],
    );
    await db.query(
      `UPDATE wallets SET usd_balance = usd_balance + $1, ssp_balance = ssp_balance + $2
        WHERE user_id = $3`,
      [netUsd, netSsp, driverId],
    );

    // Loyalty: the customer earns on the fare, the driver on net earnings.
    await awardPoints(db, trip.customer_id, pointsForFare(trip.fare_usd), "trip", tripId);
    await awardPoints(db, driverId, pointsForEarnings(netUsd), "trip_earnings", tripId);
    return good(tripId);
  });
  if (res.ok) {
    await notifyTrip(tripId, {
      exclude: driverId,
      title: "Trip completed",
      body: "Your trip is complete. Please rate your driver.",
      kind: "trip_update",
    });
  }
  return res;
}

/** Customers may cancel before the trip starts. Drivers may cancel an accepted trip. */
export async function cancelTrip(
  tripId: string,
  actor: { id: string; role: "customer" | "driver" },
  reason: string | undefined,
): Promise<Result<string>> {
  const res =
    actor.role === "customer"
      ? await guardedUpdate(
          tripId,
          `UPDATE trips SET status = 'cancelled', cancelled_at = now(), cancel_reason = $3
            WHERE id = $1 AND customer_id = $2 AND status IN ('pending', 'accepted')
            RETURNING id`,
          [tripId, actor.id, reason ?? null],
          "This trip can no longer be cancelled",
        )
      : await guardedUpdate(
          tripId,
          `UPDATE trips SET status = 'cancelled', cancelled_at = now(), cancel_reason = $3
            WHERE id = $1 AND driver_id = $2 AND status = 'accepted'
            RETURNING id`,
          [tripId, actor.id, reason ?? null],
          "This trip can no longer be cancelled by the driver",
        );
  if (res.ok) {
    await notifyTrip(tripId, {
      exclude: actor.id,
      title: "Trip cancelled",
      body: `The trip was cancelled${reason ? `: ${reason}` : "."}`,
      kind: "trip_cancelled",
    });
  }
  return res;
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
