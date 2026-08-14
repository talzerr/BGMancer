import { getDB, batch, first } from "@/lib/db";
import { eq, and, count, isNotNull, asc, sql } from "drizzle-orm";
import { tracks, videoTracks } from "@/lib/db/drizzle-schema";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
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
    roles: (row.roles ?? []) as TrackRole[],
    moods: (row.moods ?? []) as TrackMood[],
    instrumentation: (row.instrumentation ?? []) as TrackInstrumentation[],
    hasVocals: row.has_vocals != null ? !!row.has_vocals : null,
    active: row.active,
    discovered: row.discovered as Track["discovered"],
    taggedAt: row.tagged_at?.toISOString() ?? null,
  };
}

export const Tracks = {
  async getByGame(gameId: string): Promise<Track[]> {
    const rows = await getDB()
      .select()
      .from(tracks)
      .where(eq(tracks.game_id, gameId))
      .orderBy(asc(tracks.position));
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
    await getDB().execute(
      sql`UPDATE tracks SET active = false WHERE game_id = ${gameId} AND name IN (${sql.join(
        names.map((n) => sql`${n}`),
        sql`, `,
      )})`,
    );
  },

  async hasData(gameId: string): Promise<boolean> {
    const row = (await first(
      getDB().select({ cnt: count() }).from(tracks).where(eq(tracks.game_id, gameId)),
    )) ?? { cnt: 0 };
    return row.cnt > 0;
  },

  async isTagged(gameId: string): Promise<boolean> {
    const row = (await first(
      getDB()
        .select({ cnt: count() })
        .from(tracks)
        .where(and(eq(tracks.game_id, gameId), isNotNull(tracks.tagged_at))),
    )) ?? { cnt: 0 };
    return row.cnt > 0;
  },

  async countTagged(gameId: string): Promise<number> {
    const row = (await first(
      getDB()
        .select({ cnt: count() })
        .from(tracks)
        .where(and(eq(tracks.game_id, gameId), isNotNull(tracks.tagged_at))),
    )) ?? { cnt: 0 };
    return row.cnt;
  },

  async updateTags(
    gameId: string,
    name: string,
    tags: {
      energy: number;
      roles: string[];
      moods: string[];
      instrumentation: string[];
      hasVocals: boolean;
    },
  ): Promise<void> {
    await getDB()
      .update(tracks)
      .set({
        energy: tags.energy,
        roles: tags.roles,
        moods: tags.moods,
        instrumentation: tags.instrumentation,
        has_vocals: tags.hasVocals ? 1 : 0,
        tagged_at: sql`now()`,
        active: sql`CASE WHEN ${tracks.discovered} = 'approved' THEN true ELSE ${tracks.active} END`,
      })
      .where(and(eq(tracks.game_id, gameId), eq(tracks.name, name)));
  },

  async insertDiscovered(gameId: string, name: string): Promise<void> {
    await getDB().execute(sql`
      INSERT INTO tracks (game_id, name, position, active, discovered)
      VALUES (${gameId}, ${name}, (SELECT COALESCE(MAX(position), 0) + 1 FROM tracks WHERE game_id = ${gameId}), false, 'pending')
      ON CONFLICT DO NOTHING
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
      await getDB().update(tracks).set(set).where(eq(tracks.game_id, gameId));
    }
  },

  async bulkSetActive(gameId: string, names: string[], active: boolean): Promise<void> {
    await batch(
      names.map((name) =>
        getDB()
          .update(tracks)
          .set({ active })
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
      roles?: string[] | null;
      moods?: string[] | null;
      instrumentation?: string[] | null;
      hasVocals?: boolean | null;
    },
  ): Promise<void> {
    const tagFields = ["energy", "roles", "moods", "instrumentation", "hasVocals"];
    const isTagChange = tagFields.some((k) => fields[k as keyof typeof fields] !== undefined);

    const set: PgUpdateSetSource<typeof tracks> = {};

    if (fields.newName !== undefined) set.name = fields.newName;
    if (fields.active !== undefined) set.active = fields.active;
    if (fields.energy !== undefined) set.energy = fields.energy;
    if (fields.roles !== undefined) set.roles = fields.roles;
    if (fields.moods !== undefined) set.moods = fields.moods;
    if (fields.instrumentation !== undefined) set.instrumentation = fields.instrumentation;
    if (fields.hasVocals !== undefined) {
      set.has_vocals = fields.hasVocals === null ? null : fields.hasVocals ? 1 : 0;
    }
    if (isTagChange) set.tagged_at = sql`now()`;

    if (Object.keys(set).length === 0) return;

    await getDB()
      .update(tracks)
      .set(set)
      .where(and(eq(tracks.game_id, gameId), eq(tracks.name, name)));
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
    await getDB().delete(tracks).where(eq(tracks.game_id, gameId));
  },

  async listAllWithVideoIds(): Promise<BackstageTrackRow[]> {
    const rows = await getDB().execute(sql`
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
    if (filters.gameTitle) conditions.push(sql`g.title ILIKE ${`%${filters.gameTitle}%`}`);
    if (filters.name) conditions.push(sql`t.name ILIKE ${`%${filters.name}%`}`);
    if (filters.energy != null) conditions.push(sql`t.energy = ${filters.energy}`);
    if (filters.active != null) conditions.push(sql`t.active = ${filters.active}`);
    if (filters.untaggedOnly) conditions.push(sql.raw("t.tagged_at IS NULL"));

    const whereClause =
      conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql.raw(" AND "))}` : sql.raw("");

    const rows = await getDB().execute(sql`
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
