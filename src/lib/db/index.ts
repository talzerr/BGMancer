import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import * as schema from "./drizzle-schema";
import { seedDefaultUser } from "./seed";

export { LOCAL_USER_ID, LOCAL_LIBRARY_ID } from "./seed";

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

let _db: DrizzleDB | null = null;

/** Returns the Drizzle-wrapped database instance. */
export function getDB(): DrizzleDB {
  if (!_db) {
    const dbPath = process.env.SQLITE_PATH ?? path.join(process.cwd(), "bgmancer.db");
    const raw = new Database(dbPath);
    raw.pragma("journal_mode = WAL");
    raw.pragma("foreign_keys = ON");
    _db = drizzle(raw, { schema });
    migrate(_db, { migrationsFolder: path.join(process.cwd(), "drizzle/migrations") });
    seedDefaultUser(_db);
  }
  return _db;
}
