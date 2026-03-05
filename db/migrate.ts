/**
 * Custom migration runner using postgres-js (works in Node.js without WebSocket setup).
 * The app uses @neondatabase/serverless (HTTP) at runtime; this script uses postgres-js
 * only at migration time (dev/build).
 *
 * Run with: npm run db:migrate
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local");
}

const client = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(client);

migrate(db, { migrationsFolder: "./db/migrations" })
  .then(() => client.end())
  .then(() => {
    console.log("✅ Migrations applied");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  });
