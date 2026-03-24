import Database from "better-sqlite3";
import path from "path";
import { initSchema } from "./schema";
import { seedDefaultUser } from "./seed";

export { LOCAL_USER_ID, LOCAL_LIBRARY_ID } from "./seed";

let _db: Database.Database | null = null;

export function getDB(): Database.Database {
  if (!_db) {
    const dbPath = process.env.SQLITE_PATH ?? path.join(process.cwd(), "bgmancer.db");
    _db = new Database(dbPath);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
    seedDefaultUser(_db);
  }
  return _db;
}
