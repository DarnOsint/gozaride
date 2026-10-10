import { ok, serverError } from "@/lib/http";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Lightweight liveness + readiness probe used by the load balancer,
// Docker healthcheck and uptime monitors. Returns 200 only when the
// database is reachable.
export async function GET() {
  try {
    await query("SELECT 1");
    return ok({ status: "up", time: new Date().toISOString() });
  } catch (err) {
    return serverError("health", err);
  }
}