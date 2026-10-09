// Creates or updates the first admin account. Admins cannot self-register.
// Usage: DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/create-admin.mjs
import bcrypt from "bcryptjs";
import pg from "pg";

const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD");
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 12) {
  console.error("ADMIN_PASSWORD must be at least 12 characters");
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
try {
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await client.query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES (lower($1), $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, role = 'admin', is_active = true`,
    [ADMIN_EMAIL, hash, ADMIN_NAME ?? "Platform Admin"],
  );
  console.log("admin ready:", ADMIN_EMAIL);
} finally {
  await client.end();
}
