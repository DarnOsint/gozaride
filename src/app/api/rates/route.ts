import { currentRate } from "@/lib/rates";
import { fail, ok, serverError } from "@/lib/http";

/** Public: the current admin-set SSP rate. */
export async function GET() {
  try {
    const rate = await currentRate();
    if (!rate) {
      return fail(503, "The exchange rate has not been set yet. Trips are unavailable until an admin sets it.");
    }
    return ok({ base: "USD", quote: "SSP", ...rate });
  } catch (err) {
    return serverError("rates", err);
  }
}
