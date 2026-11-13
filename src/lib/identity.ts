/** Email addresses always contain "@"; everything else is treated as a phone. */
export function isEmailIdentifier(value: string): boolean {
  return value.trim().includes("@");
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Store one canonical form so "+211 921 234 567", "0921234567" and
 * "211921234567" all match. South Sudan numbers are +211 plus 9 digits.
 */
export function normalizePhone(value: string): string {
  const digits = phoneDigits(value);
  if (!digits) return "";
  if (digits.startsWith("211")) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith("0")) return `+211${digits.slice(1)}`;
  if (digits.length === 9) return `+211${digits}`;
  return `+${digits}`;
}

export function normalizeIdentifier(value: string): string {
  const trimmed = value.trim();
  return isEmailIdentifier(trimmed) ? normalizeEmail(trimmed) : normalizePhone(trimmed);
}

/** Last 9 digits make a forgiving comparison key for stored phone numbers. */
export function phoneKey(value: string): string {
  return phoneDigits(value).slice(-9);
}

/** A usable identifier is either an email or at least 6 phone digits. */
export function isUsableIdentifier(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isEmailIdentifier(trimmed)) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  return phoneDigits(trimmed).length >= 6;
}
