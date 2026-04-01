/* eslint-disable @typescript-eslint/no-require-imports */
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./drizzle-schema";

export { LOCAL_USER_ID, LOCAL_LIBRARY_ID } from "./seed";

// Both drivers share the same Drizzle query API but have slightly different
// return types (sync vs async wrappers). We use the better-sqlite3 type as
// the canonical type since it's what the repos are typed against.
// `import type` is erased at runtime — neither driver is bundled by this line.
export type DrizzleDB = BetterSQLite3Database<typeof schema>;

let _db: DrizzleDB | null = null;

/**
 * Returns the Drizzle-wrapped database instance.
 *
 * - In Cloudflare Workers: uses the D1 binding from getCloudflareContext()
 * - In local dev / tests: uses better-sqlite3 with file-based SQLite
 */
export function getDB(): DrizzleDB {
  if (!_db) {
    if (isCloudflareWorkers()) {
      _db = initD1();
    } else {
      _db = initBetterSqlite3();
    }
  }
  return _db;
}

/** Detect if we're running inside Cloudflare Workers (not local Node.js). */
function isCloudflareWorkers(): boolean {
  // env.isDev is true in development/test (Node.js), false in production (Workers).
  // Dynamic require to avoid pulling env.ts into the module scope at import time.
  const { env } = require("@/lib/env");
  return !env.isDev;
}

/** Production: Drizzle over Cloudflare D1 binding. */
function initD1(): DrizzleDB {
  // Dynamic import avoids pulling @opennextjs/cloudflare into local dev/test bundles
  const { getCloudflareContext } = require("@opennextjs/cloudflare");
  const { drizzle } = require("drizzle-orm/d1");

  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema }) as unknown as DrizzleDB;
  // Migrations are applied via `wrangler d1 migrations apply` before deploy.
  // No seed — production users are created via OAuth sign-in.
}

/** Local dev & tests: Drizzle over better-sqlite3. */
function initBetterSqlite3(): DrizzleDB {
  const Database = require("better-sqlite3");
  const { drizzle } = require("drizzle-orm/better-sqlite3");
  const { migrate } = require("drizzle-orm/better-sqlite3/migrator");
  const path = require("path");

  const { env } = require("@/lib/env");
  const { seedDefaultUser } = require("./seed");

  const dbPath = env.sqlitePath ?? path.join(process.cwd(), "bgmancer.db");
  const raw = new Database(dbPath);
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");
  const db = drizzle(raw, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle/migrations") });
  seedDefaultUser(db);
  return db;
}
