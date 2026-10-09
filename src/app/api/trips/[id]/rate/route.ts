import { requireSession } from "@/lib/auth";
import { parseBody, fail, ok, serverError, isResponse } from "@/lib/http";
import { rateTrip } from "@/lib/transitions";
import { ratingSchema } from "@/lib/validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req, ["customer", "driver"]);
  if (isResponse(session)) return session;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return fail(404, "Trip not found");

  const body = await parseBody(req, ratingSchema);
  if (isResponse(body)) return body;

  try {
    const res = await rateTrip(
      id,
      { id: session.id, role: session.role as "customer" | "driver" },
      body.stars,
      body.comment,
    );
    if (!res.ok) return fail(res.status, res.message);
    return ok({ rated_user_id: res.value.ratee_id }, 201);
  } catch (err) {
    return serverError("rate trip", err);
  }
}
