import { getDB, batch, first } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { users, libraries } from "@/lib/db/drizzle-schema";
import type { User } from "@/types";
import { newId } from "@/lib/uuid";

function rowToUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    steam_id: row.steam_id,
    steam_synced_at: row.steam_synced_at,
    created_at: row.created_at,
  };
}

export const Users = {
  /** Create or fetch a user from an OAuth profile (email is the unique key). */
  async createFromOAuth(email: string): Promise<User> {
    const db = getDB();
    const existing = await first(db.select().from(users).where(eq(users.email, email)));
    if (existing) return rowToUser(existing);

    const id = newId();
    const username = email.split("@")[0];

    await batch([
      db.insert(users).values({ id, email, username }).onConflictDoNothing(),
      db.insert(libraries).values({ id: newId(), user_id: id }).onConflictDoNothing(),
    ]);

    return rowToUser((await first(db.select().from(users).where(eq(users.id, id))))!);
  },

  async getOrCreate(id: string): Promise<User> {
    const db = getDB();
    const existing = await first(db.select().from(users).where(eq(users.id, id)));
    if (existing) return rowToUser(existing);

    await batch([
      db
        .insert(users)
        .values({ id, email: `anon+${id}@bgmancer.app` })
        .onConflictDoNothing(),
      db.insert(libraries).values({ id: newId(), user_id: id }).onConflictDoNothing(),
    ]);

    return rowToUser((await first(db.select().from(users).where(eq(users.id, id))))!);
  },

  async getById(id: string): Promise<User | null> {
    const row = await first(getDB().select().from(users).where(eq(users.id, id)));
    return row ? rowToUser(row) : null;
  },

  async tryAcquireGenerationLock(
    id: string,
    cooldownMs: number,
  ): Promise<{ acquired: boolean; reason?: string }> {
    const db = getDB();
    const row = await first(
      db
        .select({ is_generating: users.is_generating, last_generated_at: users.last_generated_at })
        .from(users)
        .where(eq(users.id, id)),
    );

    if (!row) return { acquired: false, reason: "User not found" };

    if (row.is_generating) {
      return {
        acquired: false,
        reason: "A generation is already in progress. Please wait for it to finish.",
      };
    }

    const lastGenTime = row.last_generated_at ? new Date(row.last_generated_at).getTime() : 0;
    const cooldownRemaining = cooldownMs - (Date.now() - lastGenTime);
    if (cooldownRemaining > 0) {
      return {
        acquired: false,
        reason: `Please wait ${Math.ceil(cooldownRemaining / 1000)}s before generating again.`,
      };
    }

    await db.update(users).set({ is_generating: true }).where(eq(users.id, id));
    return { acquired: true };
  },

  async releaseGenerationLock(id: string): Promise<void> {
    await getDB()
      .update(users)
      .set({
        is_generating: false,
        last_generated_at: sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      })
      .where(eq(users.id, id));
  },
};
