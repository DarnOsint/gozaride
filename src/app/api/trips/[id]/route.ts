import { requireSession } from "@/lib/auth";
import { fail, ok, serverError, isResponse } from "@/lib/http";
import { canSeeTrip, getTrip } from "@/lib/trips";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req, ["customer", "driver", "admin"]);
  if (isResponse(session)) return session;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return fail(404, "Trip not found");

  try {
    const trip = await getTrip(id);
    if (!trip || !canSeeTrip(trip, session)) return fail(404, "Trip not found");
    return ok({ trip });
  } catch (err) {
    return serverError("get trip", err);
  }
}
