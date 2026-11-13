import { queryOne } from "./db";
import { isEmailIdentifier, normalizeEmail, phoneKey } from "./identity";

export type AccountRow = {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  role: "customer" | "driver" | "shop" | "admin";
  default_currency: "usd" | "ssp";
  password_hash: string;
  is_active: boolean;
};

const COLUMNS =
  "id, email, phone, full_name, role, default_currency, password_hash, is_active";

export function findByEmail(email: string) {
  return queryOne<AccountRow>(
    `SELECT ${COLUMNS} FROM users WHERE email = $1`,
    [normalizeEmail(email)],
  );
}

export function findByPhone(phone: string) {
  return queryOne<AccountRow>(
    `SELECT ${COLUMNS} FROM users
      WHERE phone IS NOT NULL
        AND right(regexp_replace(phone, '\\D', '', 'g'), 9) = $1`,
    [phoneKey(phone)],
  );
}

export function findByIdentifier(identifier: string) {
  return isEmailIdentifier(identifier) ? findByEmail(identifier) : findByPhone(identifier);
}
