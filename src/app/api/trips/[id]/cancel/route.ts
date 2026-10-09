import { requireSession } from "@/lib/auth";
import { parseBody, fail, ok, serverError, isResponse } from "@/lib/http";
import { cancelTrip } from "@/lib/transitions";
import { canSeeTrip, getTrip } from "@/lib/trips";
import { cancelSchema } from "@/lib/validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req, ["customer", "driver"]);
  if (isResponse(session)) return session;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return fail(404, "Trip not found");

  const body = await parseBody(req, cancelSchema);
  if (isResponse(body)) return body;

  try {
    const trip = await getTrip(id);
    if (!trip || !canSeeTrip(trip, session)) return fail(404, "Trip not found");
    const res = await cancelTrip(id, { id: session.id, role: session.role as "customer" | "driver" }, body.reason);
    if (!res.ok) return fail(res.status, res.message);
    return ok({ trip: await getTrip(id) });
  } catch (err) {
    return serverError("cancel trip", err);
  }
}
