import { eq, desc, and } from "drizzle-orm";
import { libraries, playlists } from "./drizzle-schema";
import type { DrizzleDB } from ".";

/** Drizzle subquery: resolve library ID for a user. Replaces raw LIBRARY_SQ. */
export function libraryIdSq(db: DrizzleDB, userId: string) {
  return db
    .select({ id: libraries.id })
    .from(libraries)
    .where(eq(libraries.user_id, userId))
    .limit(1);
}

/** Drizzle subquery: resolve active (most recent non-archived) playlist for a user. Replaces raw ACTIVE_SESSION_SQ. */
export function activeSessionSq(db: DrizzleDB, userId: string) {
  return db
    .select({ id: playlists.id })
    .from(playlists)
    .where(and(eq(playlists.user_id, userId), eq(playlists.is_archived, false)))
    .orderBy(desc(playlists.created_at))
    .limit(1);
}
