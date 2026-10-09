import jwt from "jsonwebtoken";
import { queryOne } from "./db";
import { fail } from "./http";

export type Role = "customer" | "driver" | "shop" | "admin";

export type Session = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  default_currency: "usd" | "ssp";
};

const DEV_SECRET = "dev-only-secret-do-not-use-in-production";

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set to at least 32 characters in production");
  }
  return DEV_SECRET;
}

export function signToken(userId: string, role: Role): string {
  return jwt.sign({ sub: userId, role }, secret(), {
    expiresIn: "7d",
    algorithm: "HS256",
  });
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/** Returns the active user for a valid token, or null. */
export async function sessionFrom(req: Request): Promise<Session | null> {
  const token = bearerToken(req);
  if (!token) return null;
  let payload: { sub?: string };
  try {
    payload = jwt.verify(token, secret(), { algorithms: ["HS256"] }) as { sub?: string };
  } catch {
    return null;
  }
  if (!payload.sub) return null;
  return queryOne<Session>(
    `SELECT id, email, full_name, role, default_currency
       FROM users
      WHERE id = $1 AND is_active`,
    [payload.sub],
  );
}

/**
 * Require an authenticated user with one of the given roles.
 * Usage: const s = await requireSession(req, ["driver"]); if (s instanceof Response) return s;
 */
export async function requireSession(
  req: Request,
  roles?: Role[],
): Promise<Session | Response> {
  const session = await sessionFrom(req);
  if (!session) return fail(401, "Sign in required");
  if (roles && !roles.includes(session.role)) {
    return fail(403, "You do not have permission to do this");
  }
  return session;
}
