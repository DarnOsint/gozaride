import { query, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseBody, fail, ok, serverError, isResponse } from "@/lib/http";
import { sosSchema } from "@/lib/validation";
import { getTrip, canSeeTrip } from "@/lib/trips";
import { notify } from "@/lib/push";

/**
 * Raise a safety incident (SOS or report) against a trip. The reporter must be
 * a participant (or an admin). Admins are notified immediately and the other
 * person on the trip is alerted so they know help is coming.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req, ["customer", "driver", "admin"]);
  if (isResponse(session)) return session;

  const { id } = await ctx.params;
  const body = await parseBody(req, sosSchema);
  if (isResponse(body)) return body;

  try {
    const trip = await getTrip(id);
    if (!trip) return fail(404, "Trip not found");
    if (!canSeeTrip(trip, session)) return fail(403, "You cannot report on this trip");

    const incident = await queryOne<{ id: string; created_at: string }>(
      `INSERT INTO safety_incidents (trip_id, reported_by, kind, latitude, longitude, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [id, session.id, body.kind, body.latitude ?? null, body.longitude ?? null, body.note ?? null],
    );

    const admins = await query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'admin' AND is_active`,
    );
    const counterpart =
      session.id === trip.customer_id ? trip.driver_id : trip.customer_id;
    const recipients = new Set<string>(admins.map((a) => a.id));
    if (counterpart) recipients.add(counterpart);
    recipients.delete(session.id);

    const title = body.kind === "sos" ? "SOS raised on a trip" : "Safety report";
    await Promise.all(
      [...recipients].map((uid) =>
        notify(uid, {
          title,
          body: body.note || "Someone on an active trip needs attention.",
          kind: "sos",
          data: { trip_id: id, incident_id: incident?.id },
        }),
      ),
    );

    return ok({ incident }, 201);
  } catch (err) {
    return serverError("sos", err);
  }
}
