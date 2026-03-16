/**
 * Migration runner using the neon-http driver (HTTP fetch, no WebSocket needed).
 * Run with: npm run db:migrate
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local");
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

migrate(db, { migrationsFolder: "./db/migrations" })
  .then(() => {
    console.log("✅ Migrations applied");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  });
