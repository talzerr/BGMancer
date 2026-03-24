import type Database from "better-sqlite3";

export const LOCAL_USER_ID = "01960000-0000-7000-8000-000000000001";
export const LOCAL_LIBRARY_ID = "01960000-0000-7000-8000-000000000002";

export function seedDefaultUser(db: Database.Database): void {
  db.prepare(
    "INSERT OR IGNORE INTO users (id, email, username, tier) VALUES (?, 'local@bgmancer.app', 'Local', 'bard')",
  ).run(LOCAL_USER_ID);
  db.prepare("INSERT OR IGNORE INTO libraries (id, user_id) VALUES (?, ?)").run(
    LOCAL_LIBRARY_ID,
    LOCAL_USER_ID,
  );
}
