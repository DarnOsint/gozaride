import { requireSession } from "@/lib/auth";
import { fail, ok, serverError, isResponse } from "@/lib/http";
import { startTrip } from "@/lib/transitions";
import { getTrip } from "@/lib/trips";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req, ["driver"]);
  if (isResponse(session)) return session;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return fail(404, "Trip not found");
  try {
    const res = await startTrip(id, session.id);
    if (!res.ok) return fail(res.status, res.message);
    return ok({ trip: await getTrip(id) });
  } catch (err) {
    return serverError("start trip", err);
  }
}
