import { getDB } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { games, playlistTrackDecisions } from "@/lib/db/drizzle-schema";
import { toGames } from "@/lib/db/mappers";
import type { OnboardingPhase } from "@/types";
import type { Game } from "@/types";
import { newId } from "@/lib/uuid";
import { steamHeaderUrl } from "@/lib/constants";
import { Games } from "./games";

export interface BackstageGame {
  id: string;
  title: string;
  onboarding_phase: OnboardingPhase;
  published: boolean;
  tracklist_source: string | null;
  needs_review: boolean;
  trackCount: number;
  taggedCount: number;
  activeCount: number;
  reviewFlagCount: number;
}

export interface GameUpdateFields {
  title?: string;
  steam_appid?: number | null;
  tracklist_source?: string | null;
  yt_playlist_id?: string | null;
  thumbnail_url?: string | null;
  needs_review?: boolean;
}

function toBackstageGame(r: Record<string, unknown>): BackstageGame {
  return {
    id: String(r.id),
    title: String(r.title),
    onboarding_phase: String(r.onboarding_phase) as BackstageGame["onboarding_phase"],
    published: !!r.published,
    tracklist_source: r.tracklist_source != null ? String(r.tracklist_source) : null,
    needs_review: !!r.needs_review,
    trackCount: Number(r.track_count ?? 0),
    taggedCount: Number(r.tagged_count ?? 0),
    activeCount: Number(r.active_count ?? 0),
    reviewFlagCount: Number(r.review_flag_count ?? 0),
  };
}

export const BackstageGames = {
  async createDraft(title: string, steamAppid?: number | null): Promise<Game> {
    const id = newId();
    const thumbnail = steamAppid ? steamHeaderUrl(steamAppid) : null;
    getDB()
      .insert(games)
      .values({
        id,
        title,
        steam_appid: steamAppid ?? null,
        thumbnail_url: thumbnail,
      })
      .run();
    const created = await Games.getById(id);
    if (!created) throw new Error(`[BackstageGames.createDraft] game ${id} not found after INSERT`);
    return created;
  },

  async setPlaylistId(id: string, playlistId: string): Promise<void> {
    getDB().update(games).set({ yt_playlist_id: playlistId }).where(eq(games.id, id)).run();
  },

  async setPhase(id: string, phase: OnboardingPhase): Promise<void> {
    getDB()
      .update(games)
      .set({
        onboarding_phase: phase,
        updated_at: sql`strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
      })
      .where(eq(games.id, id))
      .run();
  },

  async setPublished(id: string, published: boolean): Promise<void> {
    getDB()
      .update(games)
      .set({
        published,
        updated_at: sql`strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
      })
      .where(eq(games.id, id))
      .run();
  },

  async listPublished(search?: string, limit?: number): Promise<Game[]> {
    const db = getDB();
    if (search?.trim()) {
      return toGames(
        db.all(sql`
          SELECT * FROM games WHERE published = 1 AND title LIKE ${`%${search.trim()}%`}
          ORDER BY title ASC LIMIT ${limit ?? 15}
        `),
      );
    }
    return toGames(
      db.all(sql`
        SELECT * FROM games WHERE published = 1 ORDER BY title ASC LIMIT ${limit ?? 15}
      `),
    );
  },

  async update(id: string, fields: GameUpdateFields): Promise<Game | null> {
    const setParts: ReturnType<typeof sql>[] = [];

    if (fields.title !== undefined) setParts.push(sql`title = ${fields.title}`);
    if (fields.tracklist_source !== undefined)
      setParts.push(sql`tracklist_source = ${fields.tracklist_source}`);
    if (fields.yt_playlist_id !== undefined)
      setParts.push(sql`yt_playlist_id = ${fields.yt_playlist_id}`);
    if (fields.thumbnail_url !== undefined)
      setParts.push(sql`thumbnail_url = ${fields.thumbnail_url}`);
    if (fields.steam_appid !== undefined) setParts.push(sql`steam_appid = ${fields.steam_appid}`);
    if (fields.needs_review !== undefined)
      setParts.push(sql`needs_review = ${fields.needs_review ? 1 : 0}`);

    if (setParts.length > 0) {
      setParts.push(sql.raw("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')"));
      const setClause = sql.join(setParts, sql.raw(", "));
      getDB().run(sql`UPDATE games SET ${setClause} WHERE id = ${id}`);
    }
    return await Games.getById(id);
  },

  async destroy(id: string): Promise<void> {
    const game = await Games.getById(id);
    if (!game) return;
    if (game.published) throw new Error("[BackstageGames.destroy] cannot delete a published game");

    getDB().transaction((tx) => {
      tx.delete(playlistTrackDecisions).where(eq(playlistTrackDecisions.game_id, id)).run();
      tx.delete(games).where(eq(games.id, id)).run();
    });
  },

  async listWithTrackStats(): Promise<BackstageGame[]> {
    const rows = getDB().all(sql`
      SELECT
        g.id, g.title, g.onboarding_phase, g.published, g.tracklist_source, g.needs_review,
        SUM(CASE WHEN t.name IS NOT NULL AND (t.discovered IS NULL OR t.discovered != 'rejected') THEN 1 ELSE 0 END) AS track_count,
        COUNT(t.tagged_at) AS tagged_count,
        SUM(CASE WHEN t.active = 1 THEN 1 ELSE 0 END) AS active_count,
        (SELECT COUNT(*) FROM game_review_flags f WHERE f.game_id = g.id) AS review_flag_count
      FROM games g
      LEFT JOIN tracks t ON t.game_id = g.id
      GROUP BY g.id
      ORDER BY review_flag_count DESC, g.title ASC
    `);
    return (rows as Record<string, unknown>[]).map(toBackstageGame);
  },

  async searchWithStats(filters: {
    title?: string;
    phase?: string;
    needsReview?: boolean;
    published?: boolean;
  }): Promise<BackstageGame[]> {
    const conditions: ReturnType<typeof sql>[] = [];

    if (filters.title) conditions.push(sql`g.title LIKE ${`%${filters.title}%`}`);
    if (filters.phase) conditions.push(sql`g.onboarding_phase = ${filters.phase}`);
    if (filters.needsReview !== undefined)
      conditions.push(sql`g.needs_review = ${filters.needsReview ? 1 : 0}`);
    if (filters.published !== undefined)
      conditions.push(sql`g.published = ${filters.published ? 1 : 0}`);

    const whereClause =
      conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql.raw(" AND "))}` : sql.raw("");

    const rows = getDB().all(sql`
      SELECT
        g.id, g.title, g.onboarding_phase, g.published, g.tracklist_source, g.needs_review,
        SUM(CASE WHEN t.name IS NOT NULL AND (t.discovered IS NULL OR t.discovered != 'rejected') THEN 1 ELSE 0 END) AS track_count,
        COUNT(t.tagged_at) AS tagged_count,
        SUM(CASE WHEN t.active = 1 THEN 1 ELSE 0 END) AS active_count,
        (SELECT COUNT(*) FROM game_review_flags f WHERE f.game_id = g.id) AS review_flag_count
      FROM games g
      LEFT JOIN tracks t ON t.game_id = g.id
      ${whereClause}
      GROUP BY g.id
      ORDER BY review_flag_count DESC, g.title ASC
      LIMIT 100
    `);
    return (rows as Record<string, unknown>[]).map(toBackstageGame);
  },

  async dashboardCounts(): Promise<
    {
      phase: string;
      count: number;
      publishedCount: number;
      needsReviewCount: number;
    }[]
  > {
    return getDB().all<{
      phase: string;
      count: number;
      publishedCount: number;
      needsReviewCount: number;
    }>(sql`
      SELECT
        onboarding_phase AS phase,
        COUNT(*) AS count,
        SUM(CASE WHEN published = 1 THEN 1 ELSE 0 END) AS publishedCount,
        SUM(CASE WHEN needs_review = 1 THEN 1 ELSE 0 END) AS needsReviewCount
      FROM games
      GROUP BY onboarding_phase
    `);
  },
};
