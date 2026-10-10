import { requireSession } from "@/lib/auth";
import { parseBody, ok, failFromError, isResponse } from "@/lib/http";
import { redeemPoints } from "@/lib/loyalty";
import { z } from "zod";

const schema = z.object({
  points: z.number().int().positive().max(10_000_000),
});

/** Convert loyalty points into wallet USD. */
export async function POST(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;

  const body = await parseBody(req, schema);
  if (isResponse(body)) return body;

  try {
    const result = await redeemPoints(session.id, body.points);
    return ok(result);
  } catch (err) {
    return failFromError(err, "loyalty redeem");
  }
}
