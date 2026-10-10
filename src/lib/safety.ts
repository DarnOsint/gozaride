import { randomBytes } from "crypto";

const TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** A long, unguessable token for read-only trip sharing links. */
export function newShareToken(): string {
  const bytes = randomBytes(24);
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  return out;
}

/** How long a share link stays valid. */
export const SHARE_TTL_HOURS = 12;
