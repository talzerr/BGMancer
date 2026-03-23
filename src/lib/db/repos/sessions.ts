import { stmt } from "./_shared";
import { toPlaylistSession } from "@/lib/db/mappers";
import type { PlaylistSession, ScoringRubric } from "@/types";
import { newId } from "@/lib/uuid";
import { MAX_PLAYLIST_SESSIONS } from "@/lib/constants";

export interface SessionWithTelemetry extends PlaylistSession {
  rubric: ScoringRubric | null;
  gameBudgets: Record<string, number> | null;
}

export const Sessions = {
  /** Creates a new session, enforcing a MAX_PLAYLIST_SESSIONS-per-user FIFO limit. */
  create(userId: string, name: string, description?: string): PlaylistSession {
    const { cnt } = stmt("SELECT COUNT(*) AS cnt FROM playlists WHERE user_id = ?").get(userId) as {
      cnt: number;
    };

    if (cnt >= MAX_PLAYLIST_SESSIONS) {
      stmt(
        "DELETE FROM playlists WHERE id = (SELECT id FROM playlists WHERE user_id = ? ORDER BY created_at ASC LIMIT 1)",
      ).run(userId);
    }

    const id = newId();
    stmt("INSERT INTO playlists (id, user_id, name, description) VALUES (?, ?, ?, ?)").run(
      id,
      userId,
      name,
      description ?? null,
    );

    const created = stmt("SELECT * FROM playlists WHERE id = ?").get(id) as Record<string, unknown>;
    return toPlaylistSession(created);
  },

  /** Returns the most recently created non-archived session for the user, or null if none exist. */
  getActive(userId: string): PlaylistSession | null {
    const row = stmt(
      "SELECT * FROM playlists WHERE user_id = ? AND is_archived = 0 ORDER BY created_at DESC LIMIT 1",
    ).get(userId) as Record<string, unknown> | undefined;
    return row ? toPlaylistSession(row) : null;
  },

  getById(id: string): PlaylistSession | null {
    const row = stmt("SELECT * FROM playlists WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toPlaylistSession(row) : null;
  },

  /** Returns all sessions for the user with a track_count field, newest first. */
  listAllWithCounts(userId: string): Array<PlaylistSession & { track_count: number }> {
    const rows = stmt(`
      SELECT p.*, COUNT(pt.id) AS track_count
      FROM playlists p
      LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
      WHERE p.user_id = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all(userId) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      ...toPlaylistSession(r),
      track_count: Number(r.track_count ?? 0),
    }));
  },

  rename(id: string, name: string): void {
    stmt("UPDATE playlists SET name = ? WHERE id = ?").run(name, id);
  },

  /** Stores rubric + game budgets on a session after generation. */
  updateTelemetry(id: string, rubric?: ScoringRubric, gameBudgets?: Record<string, number>): void {
    stmt("UPDATE playlists SET rubric = ?, game_budgets = ? WHERE id = ?").run(
      rubric ? JSON.stringify(rubric) : null,
      gameBudgets ? JSON.stringify(gameBudgets) : null,
      id,
    );
  },

  /** Returns a session with its telemetry columns parsed. */
  getByIdWithTelemetry(id: string): SessionWithTelemetry | null {
    const row = stmt("SELECT * FROM playlists WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    return {
      ...toPlaylistSession(row),
      rubric: row.rubric ? (JSON.parse(String(row.rubric)) as ScoringRubric) : null,
      gameBudgets: row.game_budgets
        ? (JSON.parse(String(row.game_budgets)) as Record<string, number>)
        : null,
    };
  },

  /** Returns recent sessions across all users — used by Backstage Theatre. */
  listRecent(limit = 20): Array<PlaylistSession & { track_count: number }> {
    const rows = stmt(`
      SELECT p.*, COUNT(pt.id) AS track_count
      FROM playlists p
      LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT ?
    `).all(limit) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      ...toPlaylistSession(r),
      track_count: Number(r.track_count ?? 0),
    }));
  },

  /** Hard-deletes a session and all its tracks (via CASCADE). */
  delete(id: string): void {
    stmt("DELETE FROM playlists WHERE id = ?").run(id);
  },
};
