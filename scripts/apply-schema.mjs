// Applies src/database/schema.sql inside one transaction. Safe to re-run.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(here, "..", "src", "database", "schema.sql");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = await readFile(schemaPath, "utf8");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("schema applied:", schemaPath);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("schema failed, nothing applied:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
