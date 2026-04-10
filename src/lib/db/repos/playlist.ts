import { getDB, batch } from "@/lib/db";
import { eq, sql, and, inArray } from "drizzle-orm";
import { playlistTracks, playlists } from "@/lib/db/drizzle-schema";
import { toPlaylistTracks } from "@/lib/db/mappers";
import type { PlaylistTrack } from "@/types";

export interface InsertableTrack {
  id: string;
  game_id: string;
  track_name: string | null;
  video_id: string | null;
  video_title: string | null;
  channel_title: string | null;
  thumbnail: string | null;
  duration_seconds?: number | null;
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
        await db.all(sql`
          SELECT pt.*, g.title AS game_title, g.thumbnail_url AS game_thumbnail_url,
                 d.arc_phase
          FROM playlist_tracks pt
          JOIN games g ON g.id = pt.game_id
          LEFT JOIN playlist_track_decisions d
            ON d.playlist_id = pt.playlist_id AND d.position = pt.position
          WHERE pt.playlist_id = ${sessionId}
          ORDER BY pt.position ASC
        `),
      );
    }
    return toPlaylistTracks(
      await db.all(sql`
        SELECT pt.*, g.title AS game_title, g.thumbnail_url AS game_thumbnail_url,
               d.arc_phase
        FROM playlist_tracks pt
        JOIN games g ON g.id = pt.game_id
        LEFT JOIN playlist_track_decisions d
          ON d.playlist_id = pt.playlist_id AND d.position = pt.position
        WHERE pt.playlist_id = (SELECT id FROM playlists WHERE user_id = ${userId} AND is_archived = 0 ORDER BY created_at DESC LIMIT 1)
        ORDER BY pt.position ASC
      `),
    );
  },

  async listUnsyncedFound(userId: string): Promise<SyncableTrackRow[]> {
    return await getDB().all<SyncableTrackRow>(sql`
      SELECT id, video_id, position
      FROM playlist_tracks
      WHERE video_id IS NOT NULL
        AND synced_at IS NULL
        AND playlist_id = (SELECT id FROM playlists WHERE user_id = ${userId} AND is_archived = 0 ORDER BY created_at DESC LIMIT 1)
      ORDER BY position ASC
    `);
  },

  async countSynced(userId: string): Promise<number> {
    const row = (await getDB().get<{ cnt: number }>(sql`
      SELECT COUNT(*) AS cnt FROM playlist_tracks
      WHERE synced_at IS NOT NULL
        AND playlist_id = (SELECT id FROM playlists WHERE user_id = ${userId} AND is_archived = 0 ORDER BY created_at DESC LIMIT 1)
    `))!;
    return row.cnt;
  },

  async replaceAll(playlistId: string, tracks: InsertableTrack[]): Promise<void> {
    await batch([
      getDB().delete(playlistTracks).where(eq(playlistTracks.playlist_id, playlistId)),
      ...tracks.map((t, position) =>
        getDB()
          .insert(playlistTracks)
          .values({
            id: t.id,
            playlist_id: playlistId,
            game_id: t.game_id,
            track_name: t.track_name,
            video_id: t.video_id,
            video_title: t.video_title,
            channel_title: t.channel_title,
            thumbnail: t.thumbnail,
            duration_seconds: t.duration_seconds ?? null,
            position,
          }),
      ),
    ]);
  },

  async clearAll(userId: string): Promise<void> {
    await getDB().run(sql`
      DELETE FROM playlist_tracks
      WHERE playlist_id = (SELECT id FROM playlists WHERE user_id = ${userId} AND is_archived = 0 ORDER BY created_at DESC LIMIT 1)
    `);
  },

  async updateVideo(
    id: string,
    videoId: string,
    title: string,
    channel: string | null,
    thumbnail: string | null,
    durationSeconds: number | null = null,
    trackName: string | null = null,
  ): Promise<void> {
    await getDB()
      .update(playlistTracks)
      .set({
        video_id: videoId,
        video_title: title,
        channel_title: channel,
        thumbnail,
        duration_seconds: durationSeconds,
        track_name: trackName,
      })
      .where(eq(playlistTracks.id, id))
      .run();
  },

  async markSynced(id: string): Promise<void> {
    await getDB()
      .update(playlistTracks)
      .set({ synced_at: sql`strftime('%Y-%m-%dT%H:%M:%SZ', 'now')` })
      .where(eq(playlistTracks.id, id))
      .run();
  },

  /** Returns the userId who owns the playlist containing this track, or null. */
  async getTrackOwnerId(trackId: string): Promise<string | null> {
    const row = await getDB().get<{ user_id: string }>(sql`
      SELECT p.user_id FROM playlist_tracks pt
      JOIN playlists p ON p.id = pt.playlist_id
      WHERE pt.id = ${trackId}
    `);
    return row?.user_id ?? null;
  },

  /** Verifies all track IDs belong to the given user. Returns false if any don't. */
  async verifyTrackOwnership(userId: string, trackIds: string[]): Promise<boolean> {
    if (trackIds.length === 0) return true;
    const rows = await getDB()
      .select({ id: playlistTracks.id })
      .from(playlistTracks)
      .innerJoin(playlists, eq(playlists.id, playlistTracks.playlist_id))
      .where(and(eq(playlists.user_id, userId), inArray(playlistTracks.id, trackIds)))
      .all();
    return rows.length === trackIds.length;
  },

  async removeOne(id: string): Promise<void> {
    await getDB().delete(playlistTracks).where(eq(playlistTracks.id, id)).run();
  },

  async getById(id: string): Promise<PlaylistTrack | undefined> {
    const rows = toPlaylistTracks(
      await getDB().all(sql`
        SELECT pt.*, g.title AS game_title, g.thumbnail_url AS game_thumbnail_url,
               d.arc_phase
        FROM playlist_tracks pt
        JOIN games g ON g.id = pt.game_id
        LEFT JOIN playlist_track_decisions d
          ON d.playlist_id = pt.playlist_id AND d.position = pt.position
        WHERE pt.id = ${id}
      `),
    );
    return rows[0];
  },

  async getVideoIdsForSession(playlistId: string): Promise<string[]> {
    const rows = await getDB()
      .select({ video_id: playlistTracks.video_id })
      .from(playlistTracks)
      .where(eq(playlistTracks.playlist_id, playlistId))
      .all();
    return rows
      .filter((r): r is typeof r & { video_id: string } => r.video_id != null)
      .map((r) => r.video_id);
  },

  async reorder(orderedIds: string[]): Promise<void> {
    await batch(
      orderedIds.map((id, i) =>
        getDB().update(playlistTracks).set({ position: i }).where(eq(playlistTracks.id, id)),
      ),
    );
  },
};
