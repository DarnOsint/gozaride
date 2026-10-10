import { requireSession } from "@/lib/auth";
import { ok, serverError, isResponse } from "@/lib/http";
import { getLoyalty } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

/** The signed-in user's loyalty balance, referral code and recent ledger. */
export async function GET(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;
  try {
    return ok(await getLoyalty(session.id));
  } catch (err) {
    return serverError("loyalty", err);
  }
}
