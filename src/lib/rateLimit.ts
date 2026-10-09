/**
 * Fixed-window in-memory limiter. Limits are per server process. When the app
 * runs on several instances behind a load balancer, move this to a shared store.
 */
const windows = new Map<string, { count: number; resetAt: number }>();

export function hitLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
