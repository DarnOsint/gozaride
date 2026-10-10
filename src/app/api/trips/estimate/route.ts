import { requireSession } from "@/lib/auth";
import { parseBody, fail, ok, serverError, isResponse } from "@/lib/http";
import { tripRequestSchema } from "@/lib/validation";
import { currentRate } from "@/lib/rates";
import { distanceKm, etaMinutes } from "@/lib/geo";
import { fareUsd, toSsp } from "@/lib/pricing";

export const dynamic = "force-dynamic";

/** Get a quick fare estimate for a trip before booking. */
export async function POST(req: Request) {
  const session = await requireSession(req, ["customer"]);
  if (isResponse(session)) return session;

  const body = await parseBody(req, tripRequestSchema);
  if (isResponse(body)) return body;

  try {
    const rate = await currentRate();
    if (!rate) {
      return fail(503, "Estimates are unavailable until an admin sets the exchange rate");
    }

    const km = distanceKm(
      { lat: body.origin.lat, lng: body.origin.lng },
      { lat: body.destination.lat, lng: body.destination.lng },
    );
    if (km < 0.05) {
      return fail(422, "Pickup and destination are the same place");
    }

    const f = fareUsd(body.service_type, km);
    return ok({
      service_type: body.service_type,
      distance_km: Math.round(km * 100) / 100,
      eta_minutes: etaMinutes(km),
      fare_usd: f,
      fare_ssp: toSsp(f, rate.ssp_per_usd),
      ssp_per_usd: rate.ssp_per_usd,
    });
  } catch (err) {
    return serverError("fare estimate", err);
  }
}
