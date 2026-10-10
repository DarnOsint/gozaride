import { query, queryOne } from "./db";

/**
 * Read a numeric setting, falling back to a default when unset or malformed.
 * Cached briefly in-process to avoid a query on every request.
 */
const cache = new Map<string, { value: number; at: number }>();
const TTL_MS = 30_000;

export async function getNumberSetting(key: string, fallback: number): Promise<number> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const row = await queryOne<{ value: string }>(`SELECT value FROM settings WHERE key = $1`, [key]);
  const parsed = row ? Number(row.value) : NaN;
  const value = Number.isFinite(parsed) ? parsed : fallback;
  cache.set(key, { value, at: Date.now() });
  return value;
}

/** Persist a numeric setting and refresh the cache. */
export async function setNumberSetting(key: string, value: number, updatedBy: string): Promise<void> {
  await query(
    `INSERT INTO settings (key, value, updated_by) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [key, String(value), updatedBy],
  );
  cache.set(key, { value, at: Date.now() });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await query<{ key: string; value: string }>(`SELECT key, value FROM settings`);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
