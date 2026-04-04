import { getDB, batch } from "@/lib/db";
import { eq, and, count, isNotNull, asc, sql } from "drizzle-orm";
import { tracks, videoTracks } from "@/lib/db/drizzle-schema";
import { toTrack } from "@/lib/db/mappers";
import type { Track, TrackRole, TrackMood, TrackInstrumentation } from "@/types";

export interface BackstageTrackRow extends Track {
  gameTitle: string;
  videoId: string | null;
  durationSeconds: number | null;
  viewCount: number | null;
}

function toBackstageTrackRow(r: Record<string, unknown>): BackstageTrackRow {
  return {
    ...toTrack(r),
    gameTitle: String(r.game_title),
    videoId: r.video_id != null ? String(r.video_id) : null,
    durationSeconds: r.duration_seconds != null ? Number(r.duration_seconds) : null,
    viewCount: r.view_count != null ? Number(r.view_count) : null,
  };
}

function rowToTrack(row: typeof tracks.$inferSelect): Track {
  const rawEnergy = row.energy != null ? Number(row.energy) : null;
  const energy = rawEnergy === 1 || rawEnergy === 2 || rawEnergy === 3 ? rawEnergy : null;
  return {
    gameId: row.game_id,
    name: row.name,
    position: row.position,
    energy,
    roles: parseJsonArray(row.roles) as TrackRole[],
    moods: parseJsonArray(row.moods) as TrackMood[],
    instrumentation: parseJsonArray(row.instrumentation) as TrackInstrumentation[],
    hasVocals: row.has_vocals != null ? !!row.has_vocals : null,
    active: row.active,
    discovered: row.discovered as Track["discovered"],
    taggedAt: row.tagged_at,
  };
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const Tracks = {
  async getByGame(gameId: string): Promise<Track[]> {
    const rows = await getDB()
      .select()
      .from(tracks)
      .where(eq(tracks.game_id, gameId))
      .orderBy(asc(tracks.position))
      .all();
    return rows.map(rowToTrack);
  },

  async upsertBatch(
    trackList: Array<{
      gameId: string;
      name: string;
      position: number;
    }>,
  ): Promise<void> {
    if (trackList.length === 0) return;

    await batch(
      trackList.map((t) =>
        getDB()
          .insert(tracks)
          .values({
            game_id: t.gameId,
            name: t.name,
            position: t.position,
          })
          .onConflictDoUpdate({
            target: [tracks.game_id, tracks.name],
            set: {
              position: sql`excluded.position`,
            },
          }),
      ),
    );
  },

  async deactivateTracks(gameId: string, names: string[]): Promise<void> {
    if (names.length === 0) return;
    await getDB().run(
      sql`UPDATE tracks SET active = 0 WHERE game_id = ${gameId} AND name IN (${sql.join(
        names.map((n) => sql`${n}`),
        sql`, `,
      )})`,
    );
  },

  async hasData(gameId: string): Promise<boolean> {
    const row = (await getDB()
      .select({ cnt: count() })
      .from(tracks)
      .where(eq(tracks.game_id, gameId))
      .get()) ?? { cnt: 0 };
    return row.cnt > 0;
  },

  async isTagged(gameId: string): Promise<boolean> {
    const row = (await getDB()
      .select({ cnt: count() })
      .from(tracks)
      .where(and(eq(tracks.game_id, gameId), isNotNull(tracks.tagged_at)))
      .get()) ?? { cnt: 0 };
    return row.cnt > 0;
  },

  async updateTags(
    gameId: string,
    name: string,
    tags: {
      energy: number;
      roles: string;
      moods: string;
      instrumentation: string;
      hasVocals: boolean;
    },
  ): Promise<void> {
    await getDB().run(sql`
      UPDATE tracks
      SET energy = ${tags.energy}, roles = ${tags.roles}, moods = ${tags.moods},
          instrumentation = ${tags.instrumentation},
          has_vocals = ${tags.hasVocals ? 1 : 0},
          tagged_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
          active = CASE WHEN discovered = 'approved' THEN 1 ELSE active END
      WHERE game_id = ${gameId} AND name = ${name}
    `);
  },

  async insertDiscovered(gameId: string, name: string): Promise<void> {
    await getDB().run(sql`
      INSERT OR IGNORE INTO tracks (game_id, name, position, active, discovered)
      VALUES (${gameId}, ${name}, (SELECT COALESCE(MAX(position), 0) + 1 FROM tracks WHERE game_id = ${gameId}), 0, 'pending')
    `);
  },

  async approveDiscovered(gameId: string, names: string[]): Promise<void> {
    if (names.length === 0) return;

    await batch(
      names.map((name) =>
        getDB()
          .update(tracks)
          .set({ discovered: "approved" })
          .where(
            and(
              eq(tracks.game_id, gameId),
              eq(tracks.name, name),
              eq(tracks.discovered, "pending"),
            ),
          ),
      ),
    );
  },

  async rejectDiscovered(gameId: string, names: string[]): Promise<void> {
    if (names.length === 0) return;

    await batch(
      names.map((name) =>
        getDB()
          .update(tracks)
          .set({ discovered: "rejected", active: false })
          .where(and(eq(tracks.game_id, gameId), eq(tracks.name, name))),
      ),
    );
  },

  async clearTags(gameId: string, names?: string[]): Promise<void> {
    const set = {
      energy: null,
      roles: null,
      moods: null,
      instrumentation: null,
      has_vocals: null,
      tagged_at: null,
    };
    if (names) {
      await batch(
        names.map((name) =>
          getDB()
            .update(tracks)
            .set(set)
            .where(and(eq(tracks.game_id, gameId), eq(tracks.name, name))),
        ),
      );
    } else {
      await getDB().update(tracks).set(set).where(eq(tracks.game_id, gameId)).run();
    }
  },

  async bulkSetActive(gameId: string, names: string[], active: boolean): Promise<void> {
    await batch(
      names.map((name) =>
        getDB()
          .update(tracks)
          .set({ active: active ? 1 : 0 })
          .where(and(eq(tracks.game_id, gameId), eq(tracks.name, name))),
      ),
    );
  },

  async updateFields(
    gameId: string,
    name: string,
    fields: {
      newName?: string;
      active?: boolean;
      energy?: number | null;
      roles?: string | null;
      moods?: string | null;
      instrumentation?: string | null;
      hasVocals?: boolean | null;
    },
  ): Promise<void> {
    const tagFields = ["energy", "roles", "moods", "instrumentation", "hasVocals"];
    const isTagChange = tagFields.some((k) => fields[k as keyof typeof fields] !== undefined);

    const setParts: ReturnType<typeof sql>[] = [];

    if (fields.newName !== undefined) setParts.push(sql`name = ${fields.newName}`);
    if (fields.active !== undefined) setParts.push(sql`active = ${fields.active ? 1 : 0}`);
    if (fields.energy !== undefined) setParts.push(sql`energy = ${fields.energy}`);
    if (fields.roles !== undefined) setParts.push(sql`roles = ${fields.roles}`);
    if (fields.moods !== undefined) setParts.push(sql`moods = ${fields.moods}`);
    if (fields.instrumentation !== undefined)
      setParts.push(sql`instrumentation = ${fields.instrumentation}`);
    if (fields.hasVocals !== undefined) {
      const val = fields.hasVocals === null ? null : fields.hasVocals ? 1 : 0;
      setParts.push(sql`has_vocals = ${val}`);
    }
    if (isTagChange) setParts.push(sql.raw("tagged_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')"));

    if (setParts.length === 0) return;

    const setClause = sql.join(setParts, sql.raw(", "));
    await getDB().run(
      sql`UPDATE tracks SET ${setClause} WHERE game_id = ${gameId} AND name = ${name}`,
    );
  },

  async deleteByKeys(keys: { gameId: string; name: string }[]): Promise<void> {
    if (keys.length === 0) return;

    await batch(
      keys.flatMap((k) => [
        getDB()
          .delete(videoTracks)
          .where(and(eq(videoTracks.game_id, k.gameId), eq(videoTracks.track_name, k.name))),
        getDB()
          .delete(tracks)
          .where(and(eq(tracks.game_id, k.gameId), eq(tracks.name, k.name))),
      ]),
    );
  },

  async deleteByGame(gameId: string): Promise<void> {
    await getDB().delete(tracks).where(eq(tracks.game_id, gameId)).run();
  },

  async listAllWithVideoIds(): Promise<BackstageTrackRow[]> {
    const rows = await getDB().all(sql`
      SELECT t.*, g.title AS game_title,
        (SELECT vt.video_id FROM video_tracks vt WHERE vt.game_id = t.game_id AND vt.track_name = t.name LIMIT 1) AS video_id,
        (SELECT vt.duration_seconds FROM video_tracks vt WHERE vt.game_id = t.game_id AND vt.track_name = t.name LIMIT 1) AS duration_seconds,
        (SELECT vt.view_count FROM video_tracks vt WHERE vt.game_id = t.game_id AND vt.track_name = t.name LIMIT 1) AS view_count
      FROM tracks t
      JOIN games g ON g.id = t.game_id
      ORDER BY g.title ASC, t.position ASC
    `);
    return (rows as Record<string, unknown>[]).map(toBackstageTrackRow);
  },

  async searchWithVideoIds(filters: {
    gameId?: string;
    gameTitle?: string;
    name?: string;
    energy?: number;
    active?: boolean;
    untaggedOnly?: boolean;
  }): Promise<BackstageTrackRow[]> {
    const conditions: ReturnType<typeof sql>[] = [];

    if (filters.gameId) conditions.push(sql`t.game_id = ${filters.gameId}`);
    if (filters.gameTitle) conditions.push(sql`g.title LIKE ${`%${filters.gameTitle}%`}`);
    if (filters.name) conditions.push(sql`t.name LIKE ${`%${filters.name}%`}`);
    if (filters.energy != null) conditions.push(sql`t.energy = ${filters.energy}`);
    if (filters.active != null) conditions.push(sql`t.active = ${filters.active ? 1 : 0}`);
    if (filters.untaggedOnly) conditions.push(sql.raw("t.tagged_at IS NULL"));

    const whereClause =
      conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql.raw(" AND "))}` : sql.raw("");

    const rows = await getDB().all(sql`
      SELECT t.*, g.title AS game_title,
        (SELECT vt.video_id FROM video_tracks vt WHERE vt.game_id = t.game_id AND vt.track_name = t.name LIMIT 1) AS video_id,
        (SELECT vt.duration_seconds FROM video_tracks vt WHERE vt.game_id = t.game_id AND vt.track_name = t.name LIMIT 1) AS duration_seconds,
        (SELECT vt.view_count FROM video_tracks vt WHERE vt.game_id = t.game_id AND vt.track_name = t.name LIMIT 1) AS view_count
      FROM tracks t
      JOIN games g ON g.id = t.game_id
      ${whereClause}
      ORDER BY g.title ASC, t.position ASC
      LIMIT 200
    `);
    return (rows as Record<string, unknown>[]).map(toBackstageTrackRow);
  },
};
