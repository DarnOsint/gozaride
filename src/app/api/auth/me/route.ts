import { requireSession } from "@/lib/auth";
import { ok, serverError, isResponse } from "@/lib/http";

export async function GET(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;
  try {
    return ok({ user: session });
  } catch (err) {
    return serverError("me", err);
  }
}
