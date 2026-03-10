import { getDB } from "@/lib/db";
import { stmt } from "./_shared";
import { toUser } from "@/lib/db/mappers";
import { UserTier } from "@/types";
import type { User } from "@/types";
import { newId } from "@/lib/uuid";

export const Users = {
  /**
   * Returns the user if they exist, otherwise creates user + library atomically.
   * Safe to call on every request — INSERT OR IGNORE makes it idempotent.
   */
  getOrCreate(id: string): User {
    const existing = stmt("SELECT * FROM users WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    if (existing) return toUser(existing);

    const db = getDB();
    db.transaction(() => {
      stmt(
        "INSERT OR IGNORE INTO users (id, email, username, tier) VALUES (?, ?, NULL, 'bard')",
      ).run(id, `anon+${id}@bgmancer.app`);
      stmt("INSERT OR IGNORE INTO libraries (id, user_id) VALUES (?, ?)").run(newId(), id);
    })();

    const created = stmt("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown>;
    return toUser(created);
  },

  getById(id: string): User | null {
    const row = stmt("SELECT * FROM users WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toUser(row) : null;
  },

  getTier(id: string): UserTier {
    const row = stmt("SELECT tier FROM users WHERE id = ?").get(id) as { tier: string } | undefined;
    return row?.tier === UserTier.Maestro ? UserTier.Maestro : UserTier.Bard;
  },

  /**
   * Atomically checks and acquires the per-user generation lock.
   * Returns { acquired: true } or { acquired: false, reason: string }.
   */
  tryAcquireGenerationLock(id: string, cooldownMs: number): { acquired: boolean; reason?: string } {
    const db = getDB();
    return db.transaction(() => {
      const row = stmt("SELECT is_generating, last_generated_at FROM users WHERE id = ?").get(
        id,
      ) as { is_generating: number; last_generated_at: string | null } | undefined;

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

      stmt("UPDATE users SET is_generating = 1 WHERE id = ?").run(id);
      return { acquired: true };
    })();
  },

  /** Releases the generation lock and stamps the completion time for cooldown tracking. */
  releaseGenerationLock(id: string): void {
    stmt(
      "UPDATE users SET is_generating = 0, last_generated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
    ).run(id);
  },
};
