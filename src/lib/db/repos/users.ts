import { getDB, batch } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { users, libraries } from "@/lib/db/drizzle-schema";
import type { User } from "@/types";
import { newId } from "@/lib/uuid";

function rowToUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    created_at: row.created_at,
  };
}

export const Users = {
  /** Create or fetch a user from an OAuth profile (email is the unique key). */
  async createFromOAuth(email: string, name?: string | null): Promise<User> {
    const db = getDB();
    const existing = await db.select().from(users).where(eq(users.email, email)).get();
    if (existing) return rowToUser(existing);

    const id = newId();

    await batch([
      db
        .insert(users)
        .values({ id, email, username: name ?? null })
        .onConflictDoNothing(),
      db.insert(libraries).values({ id: newId(), user_id: id }).onConflictDoNothing(),
    ]);

    return rowToUser((await db.select().from(users).where(eq(users.id, id)).get())!);
  },

  async getOrCreate(id: string): Promise<User> {
    const db = getDB();
    const existing = await db.select().from(users).where(eq(users.id, id)).get();
    if (existing) return rowToUser(existing);

    await batch([
      db
        .insert(users)
        .values({ id, email: `anon+${id}@bgmancer.app` })
        .onConflictDoNothing(),
      db.insert(libraries).values({ id: newId(), user_id: id }).onConflictDoNothing(),
    ]);

    return rowToUser((await db.select().from(users).where(eq(users.id, id)).get())!);
  },

  async getById(id: string): Promise<User | null> {
    const row = await getDB().select().from(users).where(eq(users.id, id)).get();
    return row ? rowToUser(row) : null;
  },

  async tryAcquireGenerationLock(
    id: string,
    cooldownMs: number,
  ): Promise<{ acquired: boolean; reason?: string }> {
    const db = getDB();
    const row = await db
      .select({ is_generating: users.is_generating, last_generated_at: users.last_generated_at })
      .from(users)
      .where(eq(users.id, id))
      .get();

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

    await db.update(users).set({ is_generating: true }).where(eq(users.id, id)).run();
    return { acquired: true };
  },

  async releaseGenerationLock(id: string): Promise<void> {
    await getDB()
      .update(users)
      .set({
        is_generating: false,
        last_generated_at: sql`strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
      })
      .where(eq(users.id, id))
      .run();
  },
};
