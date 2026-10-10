import { requireSession } from "@/lib/auth";
import { parseBody, ok, serverError, isResponse } from "@/lib/http";
import { getAllSettings, getNumberSetting, setNumberSetting } from "@/lib/settings";
import { COMMISSION_RATE } from "@/lib/pricing";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  commission_rate: z.number().min(0).max(0.9),
});

/** Admin: read current platform settings. */
export async function GET(req: Request) {
  const session = await requireSession(req, ["admin"]);
  if (isResponse(session)) return session;
  try {
    const settings = await getAllSettings();
    return ok({
      settings,
      commission_rate: await getNumberSetting("commission_rate", COMMISSION_RATE),
    });
  } catch (err) {
    return serverError("admin settings", err);
  }
}

/** Admin: update platform settings. */
export async function POST(req: Request) {
  const session = await requireSession(req, ["admin"]);
  if (isResponse(session)) return session;

  const body = await parseBody(req, schema);
  if (isResponse(body)) return body;

  try {
    await setNumberSetting("commission_rate", body.commission_rate, session.id);
    return ok({ commission_rate: body.commission_rate });
  } catch (err) {
    return serverError("admin settings update", err);
  }
}
