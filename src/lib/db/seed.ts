import { sql } from "drizzle-orm";
import type { DrizzleDB } from ".";

export const LOCAL_USER_ID = "01960000-0000-7000-8000-000000000001";
export const LOCAL_LIBRARY_ID = "01960000-0000-7000-8000-000000000002";

export async function seedDefaultUser(db: DrizzleDB): Promise<void> {
  await db.run(
    sql`INSERT OR IGNORE INTO users (id, email, username) VALUES (${LOCAL_USER_ID}, 'local@bgmancer.app', 'Local')`,
  );
  await db.run(
    sql`INSERT OR IGNORE INTO libraries (id, user_id) VALUES (${LOCAL_LIBRARY_ID}, ${LOCAL_USER_ID})`,
  );
}
