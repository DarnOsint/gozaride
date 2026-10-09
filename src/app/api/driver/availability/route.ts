import { query, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseBody, fail, ok, serverError, isResponse } from "@/lib/http";
import { availabilitySchema } from "@/lib/validation";

/** Driver: go online or offline. Cannot go offline in the middle of a trip. */
export async function POST(req: Request) {
  const session = await requireSession(req, ["driver"]);
  if (isResponse(session)) return session;

  const body = await parseBody(req, availabilitySchema);
  if (isResponse(body)) return body;

  try {
    if (!body.is_online) {
      const active = await queryOne(
        `SELECT 1 FROM trips WHERE driver_id = $1 AND status IN ('accepted', 'in_progress') LIMIT 1`,
        [session.id],
      );
      if (active) return fail(409, "Finish your current trip before going offline");
    }
    const rows = await query<{ is_online: boolean; vehicle_type: string | null; plate_number: string | null }>(
      `INSERT INTO driver_profiles (user_id, is_online, vehicle_type, plate_number)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
         SET is_online = EXCLUDED.is_online,
             vehicle_type = COALESCE(EXCLUDED.vehicle_type, driver_profiles.vehicle_type),
             plate_number = COALESCE(EXCLUDED.plate_number, driver_profiles.plate_number)
       RETURNING is_online, vehicle_type, plate_number`,
      [session.id, body.is_online, body.vehicle_type ?? null, body.plate_number ?? null],
    );
    return ok({ availability: rows[0] });
  } catch (err) {
    return serverError("driver availability", err);
  }
}
