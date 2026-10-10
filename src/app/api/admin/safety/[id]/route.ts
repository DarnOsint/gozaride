import { queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseBody, fail, ok, serverError, isResponse } from "@/lib/http";
import { incidentUpdateSchema } from "@/lib/validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Admin: acknowledge or resolve a safety incident. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req, ["admin"]);
  if (isResponse(session)) return session;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return fail(404, "Incident not found");

  const body = await parseBody(req, incidentUpdateSchema);
  if (isResponse(body)) return body;

  try {
    const updated =
      body.status === "resolved"
        ? await queryOne(
            `UPDATE safety_incidents
                SET status = 'resolved', resolved_at = now(), resolved_by = $2
              WHERE id = $1 RETURNING id, status`,
            [id, session.id],
          )
        : await queryOne(
            `UPDATE safety_incidents
                SET status = 'acknowledged', acknowledged_at = now()
              WHERE id = $1 RETURNING id, status`,
            [id],
          );
    if (!updated) return fail(404, "Incident not found");
    return ok({ incident: updated });
  } catch (err) {
    return serverError("admin safety update", err);
  }
}
