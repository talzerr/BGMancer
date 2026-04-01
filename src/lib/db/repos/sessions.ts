import { getDB } from "@/lib/db";
import { eq, desc, asc, and, count } from "drizzle-orm";
import { playlists, playlistTracks } from "@/lib/db/drizzle-schema";
import type { PlaylistSession, ScoringRubric } from "@/types";
import { newId } from "@/lib/uuid";
import { MAX_PLAYLIST_SESSIONS } from "@/lib/constants";

export interface SessionWithTelemetry extends PlaylistSession {
  rubric: ScoringRubric | null;
  gameBudgets: Record<string, number> | null;
}

function rowToSession(row: typeof playlists.$inferSelect): PlaylistSession {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description,
    is_archived: row.is_archived,
    created_at: row.created_at,
  };
}

export const Sessions = {
  /** Creates a new session, enforcing a MAX_PLAYLIST_SESSIONS-per-user FIFO limit. */
  async create(userId: string, name: string, description?: string): Promise<PlaylistSession> {
    const db = getDB();

    const { cnt } = db
      .select({ cnt: count() })
      .from(playlists)
      .where(eq(playlists.user_id, userId))
      .get()!;

    if (cnt >= MAX_PLAYLIST_SESSIONS) {
      const oldest = db
        .select({ id: playlists.id })
        .from(playlists)
        .where(eq(playlists.user_id, userId))
        .orderBy(asc(playlists.created_at))
        .limit(1)
        .get()!;
      db.delete(playlists).where(eq(playlists.id, oldest.id)).run();
    }

    const id = newId();
    db.insert(playlists)
      .values({ id, user_id: userId, name, description: description ?? null })
      .run();

    return rowToSession(db.select().from(playlists).where(eq(playlists.id, id)).get()!);
  },

  /** Returns the most recently created non-archived session for the user, or null if none exist. */
  async getActive(userId: string): Promise<PlaylistSession | null> {
    const row = getDB()
      .select()
      .from(playlists)
      .where(and(eq(playlists.user_id, userId), eq(playlists.is_archived, false)))
      .orderBy(desc(playlists.created_at))
      .limit(1)
      .get();
    return row ? rowToSession(row) : null;
  },

  async getById(id: string): Promise<PlaylistSession | null> {
    const row = getDB().select().from(playlists).where(eq(playlists.id, id)).get();
    return row ? rowToSession(row) : null;
  },

  /** Returns all sessions for the user with a track_count field, newest first. */
  async listAllWithCounts(
    userId: string,
  ): Promise<Array<PlaylistSession & { track_count: number }>> {
    const rows = getDB()
      .select({
        id: playlists.id,
        user_id: playlists.user_id,
        name: playlists.name,
        description: playlists.description,
        is_archived: playlists.is_archived,
        rubric: playlists.rubric,
        game_budgets: playlists.game_budgets,
        created_at: playlists.created_at,
        track_count: count(playlistTracks.id),
      })
      .from(playlists)
      .leftJoin(playlistTracks, eq(playlistTracks.playlist_id, playlists.id))
      .where(eq(playlists.user_id, userId))
      .groupBy(playlists.id)
      .orderBy(desc(playlists.created_at))
      .all();

    return rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      name: r.name,
      description: r.description,
      is_archived: r.is_archived,
      created_at: r.created_at,
      track_count: r.track_count,
    }));
  },

  async rename(id: string, name: string): Promise<void> {
    getDB().update(playlists).set({ name }).where(eq(playlists.id, id)).run();
  },

  /** Stores rubric + game budgets on a session after generation. */
  async updateTelemetry(
    id: string,
    rubric?: ScoringRubric,
    gameBudgets?: Record<string, number>,
  ): Promise<void> {
    getDB()
      .update(playlists)
      .set({
        rubric: rubric ? JSON.stringify(rubric) : null,
        game_budgets: gameBudgets ? JSON.stringify(gameBudgets) : null,
      })
      .where(eq(playlists.id, id))
      .run();
  },

  /** Returns a session with its telemetry columns parsed. */
  async getByIdWithTelemetry(id: string): Promise<SessionWithTelemetry | null> {
    const row = getDB().select().from(playlists).where(eq(playlists.id, id)).get();
    if (!row) return null;
    let rubric: ScoringRubric | null = null;
    let gameBudgets: Record<string, number> | null = null;
    if (row.rubric) {
      try {
        rubric = JSON.parse(row.rubric) as ScoringRubric;
      } catch {
        console.error(`[Sessions] Failed to parse rubric for session ${id}`);
      }
    }
    if (row.game_budgets) {
      try {
        gameBudgets = JSON.parse(row.game_budgets) as Record<string, number>;
      } catch {
        console.error(`[Sessions] Failed to parse game_budgets for session ${id}`);
      }
    }
    return { ...rowToSession(row), rubric, gameBudgets };
  },

  /** Returns recent sessions across all users — used by Backstage Theatre. */
  async listRecent(limit = 20): Promise<Array<PlaylistSession & { track_count: number }>> {
    const rows = getDB()
      .select({
        id: playlists.id,
        user_id: playlists.user_id,
        name: playlists.name,
        description: playlists.description,
        is_archived: playlists.is_archived,
        rubric: playlists.rubric,
        game_budgets: playlists.game_budgets,
        created_at: playlists.created_at,
        track_count: count(playlistTracks.id),
      })
      .from(playlists)
      .leftJoin(playlistTracks, eq(playlistTracks.playlist_id, playlists.id))
      .groupBy(playlists.id)
      .orderBy(desc(playlists.created_at))
      .limit(limit)
      .all();

    return rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      name: r.name,
      description: r.description,
      is_archived: r.is_archived,
      created_at: r.created_at,
      track_count: r.track_count,
    }));
  },

  /** Hard-deletes a session and all its tracks (via CASCADE). */
  async delete(id: string): Promise<void> {
    getDB().delete(playlists).where(eq(playlists.id, id)).run();
  },
};
