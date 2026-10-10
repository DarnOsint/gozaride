import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(status: number, message: string, details?: unknown) {
  return NextResponse.json(
    details === undefined ? { error: message } : { error: message, details },
    { status },
  );
}

/** Parse and validate a JSON body. Returns a Response on failure. */
export async function parseBody<T>(
  req: Request,
  schema: ZodType<T>,
): Promise<T | Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(400, "Request body must be valid JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return fail(422, "Validation failed", parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
}

/** Log the real error on the server and return a generic message. */
export function serverError(context: string, err: unknown) {
  console.error(`[api] ${context}`, err);
  return fail(500, "Something went wrong. Please try again.");
}

export function isResponse(v: unknown): v is Response {
  return v instanceof Response;
}

/** Throw inside a transaction to abort it with a specific HTTP status. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function failFromError(err: unknown, context: string): Response {
  if (err instanceof HttpError) return fail(err.status, err.message);
  return serverError(context, err);
}
