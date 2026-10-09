import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseBody, fail, ok, serverError, isResponse } from "@/lib/http";
import { z } from "zod";

const toggleSchema = z.object({ is_active: z.boolean() });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req, ["admin"]);
  if (isResponse(session)) return session;

  const { id } = await ctx.params;
  const body = await parseBody(req, z.object({ is_active: z.boolean() }));
  if (isResponse(body)) return body;

  try {
    await query("UPDATE users SET is_active = $1 WHERE id = $2", [body.is_active, id]);
    return ok({ id, is_active: body.is_active });
  } catch (err) {
    return serverError("admin toggle user", err);
  }
}
