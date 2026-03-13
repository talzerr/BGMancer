import { getDB } from "@/lib/db";
import { stmt, ACTIVE_SESSION_SQ } from "./_shared";
import { toPlaylistTracks, parseSearchQueries } from "@/lib/db/mappers";
import type { PlaylistTrack, TrackStatus } from "@/types";

export interface InsertableTrack {
  id: string;
  game_id: string;
  track_name: string | null;
  video_id: string | null;
  video_title: string | null;
  channel_title: string | null;
  thumbnail: string | null;
  search_queries: string[] | null;
  duration_seconds?: number | null;
  status: TrackStatus;
  error_message: string | null;
}

export interface PendingTrackRow {
  id: string;
  search_queries: string[] | null;
}

export interface SyncableTrackRow {
  id: string;
  video_id: string;
  position: number;
}

export const Playlist = {
  listAllWithGameTitle(userId: string, sessionId?: string): PlaylistTrack[] {
    if (sessionId) {
      return toPlaylistTracks(
        stmt(`
          SELECT pt.*, g.title AS game_title
          FROM playlist_tracks pt
          JOIN games g ON g.id = pt.game_id
          WHERE pt.playlist_id = ?
          ORDER BY pt.position ASC
        `).all(sessionId),
      );
    }
    return toPlaylistTracks(
      stmt(`
        SELECT pt.*, g.title AS game_title
        FROM playlist_tracks pt
        JOIN games g ON g.id = pt.game_id
        WHERE pt.playlist_id = ${ACTIVE_SESSION_SQ}
        ORDER BY pt.position ASC
      `).all(userId),
    );
  },

  listPending(userId: string): PendingTrackRow[] {
    const rows = stmt(`
      SELECT pt.id, pt.search_queries
      FROM playlist_tracks pt
      WHERE pt.status = 'pending'
        AND pt.playlist_id = ${ACTIVE_SESSION_SQ}
      ORDER BY pt.position ASC
    `).all(userId) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      id: String(r.id),
      search_queries: parseSearchQueries(r.search_queries),
    }));
  },

  listUnsyncedFound(userId: string): SyncableTrackRow[] {
    return stmt(`
      SELECT id, video_id, position
      FROM playlist_tracks
      WHERE status = 'found'
        AND video_id IS NOT NULL
        AND synced_at IS NULL
        AND playlist_id = ${ACTIVE_SESSION_SQ}
      ORDER BY position ASC
    `).all(userId) as SyncableTrackRow[];
  },

  countSynced(userId: string): number {
    const row = stmt(
      `SELECT COUNT(*) AS cnt FROM playlist_tracks WHERE synced_at IS NOT NULL AND playlist_id = ${ACTIVE_SESSION_SQ}`,
    ).get(userId) as { cnt: number };
    return row.cnt;
  },

  /**
   * Atomically replaces all tracks for a given session.
   * Deletes existing tracks for that playlist_id, then bulk-inserts the new set.
   */
  replaceAll(playlistId: string, tracks: InsertableTrack[]): void {
    const db = getDB();
    const insertSQL = `
      INSERT INTO playlist_tracks
        (id, playlist_id, game_id, track_name, video_id, video_title, channel_title, thumbnail,
         search_queries, duration_seconds, position, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.transaction(() => {
      stmt("DELETE FROM playlist_tracks WHERE playlist_id = ?").run(playlistId);
      const insertStmt = stmt(insertSQL);
      for (let position = 0; position < tracks.length; position++) {
        const t = tracks[position];
        insertStmt.run(
          t.id,
          playlistId,
          t.game_id,
          t.track_name,
          t.video_id,
          t.video_title,
          t.channel_title,
          t.thumbnail,
          t.search_queries ? JSON.stringify(t.search_queries) : null,
          t.duration_seconds ?? null,
          position,
          t.status,
          t.error_message,
        );
      }
    })();
  },

  /** Deletes all tracks belonging to the user's active session. */
  clearAll(userId: string): void {
    stmt(`DELETE FROM playlist_tracks WHERE playlist_id = ${ACTIVE_SESSION_SQ}`).run(userId);
  },

  setSearching(id: string): void {
    stmt("UPDATE playlist_tracks SET status = 'searching' WHERE id = ?").run(id);
  },

  setFound(
    id: string,
    videoId: string,
    title: string,
    channel: string,
    thumbnail: string,
    durationSeconds: number | null = null,
    trackName: string | null = null,
  ): void {
    stmt(`
      UPDATE playlist_tracks SET
        status = 'found', video_id = ?, video_title = ?,
        channel_title = ?, thumbnail = ?, duration_seconds = ?, track_name = ?, error_message = NULL
      WHERE id = ?
    `).run(videoId, title, channel, thumbnail, durationSeconds, trackName, id);
  },

  setError(id: string, message: string): void {
    stmt("UPDATE playlist_tracks SET status = 'error', error_message = ? WHERE id = ?").run(
      message,
      id,
    );
  },

  markSynced(id: string): void {
    stmt(
      "UPDATE playlist_tracks SET synced_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
    ).run(id);
  },

  removeOne(id: string): void {
    stmt("DELETE FROM playlist_tracks WHERE id = ?").run(id);
  },

  getById(id: string): PlaylistTrack | undefined {
    const rows = toPlaylistTracks(
      stmt(`
        SELECT pt.*, g.title AS game_title
        FROM playlist_tracks pt
        JOIN games g ON g.id = pt.game_id
        WHERE pt.id = ?
      `).all(id),
    );
    return rows[0];
  },

  getVideoIdsForGame(gameId: string): string[] {
    const rows = stmt(
      "SELECT video_id FROM playlist_tracks WHERE game_id = ? AND video_id IS NOT NULL",
    ).all(gameId) as Array<{ video_id: string }>;
    return rows.map((r) => r.video_id);
  },

  reorder(orderedIds: string[]): void {
    const db = getDB();
    const updateStmt = stmt("UPDATE playlist_tracks SET position = ? WHERE id = ?");
    db.transaction(() => {
      for (let i = 0; i < orderedIds.length; i++) {
        updateStmt.run(i, orderedIds[i]);
      }
    })();
  },

  getRecentTrackNames(
    userId: string,
    limit: number,
  ): Array<{ cleanName: string; gameTitle: string }> {
    return stmt(`
      SELECT pt.track_name AS cleanName, g.title AS gameTitle
      FROM playlist_tracks pt
      JOIN playlists p ON p.id = pt.playlist_id
      JOIN games g ON g.id = pt.game_id
      WHERE p.user_id = ?
        AND pt.track_name IS NOT NULL
        AND pt.status = 'found'
      ORDER BY p.created_at DESC, pt.position ASC
      LIMIT ?
    `).all(userId, limit) as Array<{ cleanName: string; gameTitle: string }>;
  },
};
