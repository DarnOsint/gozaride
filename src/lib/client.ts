"use client";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Call the Gozaride API with the signed-in token. Throws ApiError with the server's message. */
export async function api<T>(
  path: string,
  opts: { token?: string | null; method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data;
}

export function money(usd: number | null | undefined): string {
  if (usd === null || usd === undefined) return "-";
  return `$${usd.toFixed(2)}`;
}

export function ssp(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "-";
  return `SSP ${Math.round(amount).toLocaleString("en-US")}`;
}
