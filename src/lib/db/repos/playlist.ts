import { getDB } from "@/lib/db";
import { eq, sql, and, inArray } from "drizzle-orm";
import { playlistTracks, playlists } from "@/lib/db/drizzle-schema";
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
  async listAllWithGameTitle(userId: string, sessionId?: string): Promise<PlaylistTrack[]> {
    const db = getDB();
    if (sessionId) {
      return toPlaylistTracks(
        db.all(sql`
          SELECT pt.*, g.title AS game_title, g.thumbnail_url AS game_thumbnail_url
          FROM playlist_tracks pt
          JOIN games g ON g.id = pt.game_id
          WHERE pt.playlist_id = ${sessionId}
          ORDER BY pt.position ASC
        `),
      );
    }
    return toPlaylistTracks(
      db.all(sql`
        SELECT pt.*, g.title AS game_title, g.thumbnail_url AS game_thumbnail_url
        FROM playlist_tracks pt
        JOIN games g ON g.id = pt.game_id
        WHERE pt.playlist_id = (SELECT id FROM playlists WHERE user_id = ${userId} AND is_archived = 0 ORDER BY created_at DESC LIMIT 1)
        ORDER BY pt.position ASC
      `),
    );
  },

  async listPending(userId: string): Promise<PendingTrackRow[]> {
    const rows = getDB().all<{ id: string; search_queries: string | null }>(sql`
      SELECT pt.id, pt.search_queries
      FROM playlist_tracks pt
      WHERE pt.status = 'pending'
        AND pt.playlist_id = (SELECT id FROM playlists WHERE user_id = ${userId} AND is_archived = 0 ORDER BY created_at DESC LIMIT 1)
      ORDER BY pt.position ASC
    `);
    return rows.map((r) => ({
      id: r.id,
      search_queries: parseSearchQueries(r.search_queries),
    }));
  },

  async listUnsyncedFound(userId: string): Promise<SyncableTrackRow[]> {
    return getDB().all<SyncableTrackRow>(sql`
      SELECT id, video_id, position
      FROM playlist_tracks
      WHERE status = 'found'
        AND video_id IS NOT NULL
        AND synced_at IS NULL
        AND playlist_id = (SELECT id FROM playlists WHERE user_id = ${userId} AND is_archived = 0 ORDER BY created_at DESC LIMIT 1)
      ORDER BY position ASC
    `);
  },

  async countSynced(userId: string): Promise<number> {
    const row = getDB().get<{ cnt: number }>(sql`
      SELECT COUNT(*) AS cnt FROM playlist_tracks
      WHERE synced_at IS NOT NULL
        AND playlist_id = (SELECT id FROM playlists WHERE user_id = ${userId} AND is_archived = 0 ORDER BY created_at DESC LIMIT 1)
    `)!;
    return row.cnt;
  },

  async replaceAll(playlistId: string, tracks: InsertableTrack[]): Promise<void> {
    getDB().transaction((tx) => {
      tx.delete(playlistTracks).where(eq(playlistTracks.playlist_id, playlistId)).run();
      for (let position = 0; position < tracks.length; position++) {
        const t = tracks[position];
        tx.insert(playlistTracks)
          .values({
            id: t.id,
            playlist_id: playlistId,
            game_id: t.game_id,
            track_name: t.track_name,
            video_id: t.video_id,
            video_title: t.video_title,
            channel_title: t.channel_title,
            thumbnail: t.thumbnail,
            search_queries: t.search_queries ? JSON.stringify(t.search_queries) : null,
            duration_seconds: t.duration_seconds ?? null,
            position,
            status: t.status,
            error_message: t.error_message,
          })
          .run();
      }
    });
  },

  async clearAll(userId: string): Promise<void> {
    getDB().run(sql`
      DELETE FROM playlist_tracks
      WHERE playlist_id = (SELECT id FROM playlists WHERE user_id = ${userId} AND is_archived = 0 ORDER BY created_at DESC LIMIT 1)
    `);
  },

  async setSearching(id: string): Promise<void> {
    getDB()
      .update(playlistTracks)
      .set({ status: "searching" })
      .where(eq(playlistTracks.id, id))
      .run();
  },

  async setFound(
    id: string,
    videoId: string,
    title: string,
    channel: string,
    thumbnail: string,
    durationSeconds: number | null = null,
    trackName: string | null = null,
  ): Promise<void> {
    getDB()
      .update(playlistTracks)
      .set({
        status: "found",
        video_id: videoId,
        video_title: title,
        channel_title: channel,
        thumbnail,
        duration_seconds: durationSeconds,
        track_name: trackName,
        error_message: null,
      })
      .where(eq(playlistTracks.id, id))
      .run();
  },

  async setError(id: string, message: string): Promise<void> {
    getDB()
      .update(playlistTracks)
      .set({ status: "error", error_message: message })
      .where(eq(playlistTracks.id, id))
      .run();
  },

  async markSynced(id: string): Promise<void> {
    getDB()
      .update(playlistTracks)
      .set({ synced_at: sql`strftime('%Y-%m-%dT%H:%M:%SZ', 'now')` })
      .where(eq(playlistTracks.id, id))
      .run();
  },

  /** Returns the userId who owns the playlist containing this track, or null. */
  async getTrackOwnerId(trackId: string): Promise<string | null> {
    const row = getDB().get<{ user_id: string }>(sql`
      SELECT p.user_id FROM playlist_tracks pt
      JOIN playlists p ON p.id = pt.playlist_id
      WHERE pt.id = ${trackId}
    `);
    return row?.user_id ?? null;
  },

  /** Verifies all track IDs belong to the given user. Returns false if any don't. */
  async verifyTrackOwnership(userId: string, trackIds: string[]): Promise<boolean> {
    if (trackIds.length === 0) return true;
    const rows = getDB()
      .select({ id: playlistTracks.id })
      .from(playlistTracks)
      .innerJoin(playlists, eq(playlists.id, playlistTracks.playlist_id))
      .where(and(eq(playlists.user_id, userId), inArray(playlistTracks.id, trackIds)))
      .all();
    return rows.length === trackIds.length;
  },

  async removeOne(id: string): Promise<void> {
    getDB().delete(playlistTracks).where(eq(playlistTracks.id, id)).run();
  },

  async getById(id: string): Promise<PlaylistTrack | undefined> {
    const rows = toPlaylistTracks(
      getDB().all(sql`
        SELECT pt.*, g.title AS game_title, g.thumbnail_url AS game_thumbnail_url
        FROM playlist_tracks pt
        JOIN games g ON g.id = pt.game_id
        WHERE pt.id = ${id}
      `),
    );
    return rows[0];
  },

  async getVideoIdsForGame(gameId: string): Promise<string[]> {
    const rows = getDB()
      .select({ video_id: playlistTracks.video_id })
      .from(playlistTracks)
      .where(eq(playlistTracks.game_id, gameId))
      .all();
    return rows
      .filter((r): r is typeof r & { video_id: string } => r.video_id != null)
      .map((r) => r.video_id);
  },

  async reorder(orderedIds: string[]): Promise<void> {
    getDB().transaction((tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        tx.update(playlistTracks)
          .set({ position: i })
          .where(eq(playlistTracks.id, orderedIds[i]))
          .run();
      }
    });
  },

  async getRecentTrackNames(
    userId: string,
    limit: number,
  ): Promise<Array<{ cleanName: string; gameTitle: string }>> {
    return getDB().all<{ cleanName: string; gameTitle: string }>(sql`
      SELECT pt.track_name AS cleanName, g.title AS gameTitle
      FROM playlist_tracks pt
      JOIN playlists p ON p.id = pt.playlist_id
      JOIN games g ON g.id = pt.game_id
      WHERE p.user_id = ${userId}
        AND pt.track_name IS NOT NULL
        AND pt.status = 'found'
      ORDER BY p.created_at DESC, pt.position ASC
      LIMIT ${limit}
    `);
  },
};
