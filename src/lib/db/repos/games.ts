import { getDB } from "@/lib/db";
import { stmt, LIBRARY_SQ } from "./_shared";
import { toGame, toGames } from "@/lib/db/mappers";
import { CurationMode } from "@/types";
import type { OnboardingPhase } from "@/types";
import type { Game } from "@/types";
import { newId } from "@/lib/uuid";
import { YT_IMPORT_GAME_ID, steamHeaderUrl } from "@/lib/constants";

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

export interface SteamGameInput {
  appid: number;
  name: string;
  playtime_forever: number;
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

export const Games = {
  /** Returns all non-skip published games in the user's library — used for playlist generation. */
  listAll(userId: string, excludeId?: string): Game[] {
    const base = `
      SELECT g.*, lg.curation FROM games g
      JOIN library_games lg ON lg.game_id = g.id
      WHERE lg.library_id = ${LIBRARY_SQ}
        AND lg.curation != 'skip'
        AND g.published = 1
    `;
    if (excludeId) {
      return toGames(stmt(`${base} AND g.id != ? ORDER BY lg.added_at ASC`).all(userId, excludeId));
    }
    return toGames(stmt(`${base} ORDER BY lg.added_at ASC`).all(userId));
  },

  /** Returns all published games in the user's library regardless of curation — used by the library page. */
  listAllIncludingDisabled(userId: string): Game[] {
    return toGames(
      stmt(`
        SELECT g.*, lg.curation FROM games g
        JOIN library_games lg ON lg.game_id = g.id
        WHERE lg.library_id = ${LIBRARY_SQ}
          AND g.published = 1
        ORDER BY lg.added_at ASC
      `).all(userId),
    );
  },

  /** Returns the number of real games in the user's library, excluding the synthetic YT-import entry. */
  count(userId: string): number {
    const row = stmt(`
      SELECT COUNT(*) AS cnt FROM games g
      JOIN library_games lg ON lg.game_id = g.id
      WHERE lg.library_id = ${LIBRARY_SQ}
        AND g.id != '${YT_IMPORT_GAME_ID}'
    `).get(userId) as { cnt: number };
    return row.cnt;
  },

  findByTitle(title: string): Game | null {
    const row = stmt("SELECT * FROM games WHERE lower(title) = lower(?)").get(title) as
      | Record<string, unknown>
      | undefined;
    return row ? toGame(row) : null;
  },

  getById(id: string): Game | null {
    const row = stmt("SELECT * FROM games WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toGame(row) : null;
  },

  /** Returns a game with its curation value scoped to the given user's library. */
  getByIdForUser(userId: string, id: string): Game | null {
    const row = stmt(`
      SELECT g.*, lg.curation FROM games g
      JOIN library_games lg ON lg.game_id = g.id
      WHERE g.id = ? AND lg.library_id = ${LIBRARY_SQ}
    `).get(id, userId) as Record<string, unknown> | undefined;
    return row ? toGame(row) : null;
  },

  create(
    userId: string,
    id: string,
    title: string,
    curation: CurationMode = CurationMode.Include,
    steamAppid: number | null = null,
  ): Game {
    const db = getDB();
    const thumbnail = steamAppid ? steamHeaderUrl(steamAppid) : null;
    db.transaction(() => {
      stmt("INSERT INTO games (id, title, steam_appid, thumbnail_url) VALUES (?, ?, ?, ?)").run(
        id,
        title,
        steamAppid,
        thumbnail,
      );

      stmt(
        `INSERT OR IGNORE INTO library_games (library_id, game_id, curation) VALUES (${LIBRARY_SQ}, ?, ?)`,
      ).run(userId, id, curation);
    })();

    const created = this.getByIdForUser(userId, id);
    if (!created) throw new Error(`[Games.create] game ${id} not found after INSERT`);
    return created;
  },

  /** Creates a game record without linking to any user library — used by Backstage. */
  createDraft(title: string, steamAppid?: number | null): Game {
    const id = newId();
    const thumbnail = steamAppid ? steamHeaderUrl(steamAppid) : null;
    stmt("INSERT INTO games (id, title, steam_appid, thumbnail_url) VALUES (?, ?, ?, ?)").run(
      id,
      title,
      steamAppid ?? null,
      thumbnail,
    );
    const created = this.getById(id);
    if (!created) throw new Error(`[Games.createDraft] game ${id} not found after INSERT`);
    return created;
  },

  linkToLibrary(userId: string, gameId: string, curation = CurationMode.Include): void {
    stmt(
      `INSERT OR IGNORE INTO library_games (library_id, game_id, curation) VALUES (${LIBRARY_SQ}, ?, ?)`,
    ).run(userId, gameId, curation);
  },

  setCuration(userId: string, gameId: string, curation: CurationMode): void {
    stmt(
      `UPDATE library_games SET curation = ? WHERE library_id = ${LIBRARY_SQ} AND game_id = ?`,
    ).run(curation, userId, gameId);
  },

  setPlaylistId(id: string, playlistId: string): void {
    stmt("UPDATE games SET yt_playlist_id = ? WHERE id = ?").run(playlistId, id);
  },

  setPhase(id: string, phase: OnboardingPhase): void {
    stmt(
      `UPDATE games SET onboarding_phase = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
    ).run(phase, id);
  },

  setPublished(id: string, published: boolean): void {
    stmt(
      `UPDATE games SET published = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
    ).run(published ? 1 : 0, id);
  },

  listPublished(search?: string, limit?: number): Game[] {
    if (search?.trim()) {
      return toGames(
        getDB()
          .prepare(
            `SELECT * FROM games WHERE published = 1 AND title LIKE ? ORDER BY title ASC LIMIT ?`,
          )
          .all(`%${search.trim()}%`, limit ?? 15),
      );
    }
    return toGames(
      stmt("SELECT * FROM games WHERE published = 1 ORDER BY title ASC LIMIT ?").all(limit ?? 15),
    );
  },

  update(id: string, fields: GameUpdateFields): Game | null {
    const sets: string[] = [];
    const params: unknown[] = [];

    const simple: Array<[keyof GameUpdateFields, string]> = [
      ["title", "title"],
      ["tracklist_source", "tracklist_source"],
      ["yt_playlist_id", "yt_playlist_id"],
      ["thumbnail_url", "thumbnail_url"],
    ];
    for (const [key, col] of simple) {
      if (fields[key] !== undefined) {
        sets.push(`${col} = ?`);
        params.push(fields[key]);
      }
    }
    if (fields.steam_appid !== undefined) {
      sets.push("steam_appid = ?");
      params.push(fields.steam_appid);
    }
    if (fields.needs_review !== undefined) {
      sets.push("needs_review = ?");
      params.push(fields.needs_review ? 1 : 0);
    }

    if (sets.length > 0) {
      sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");
      params.push(id);
      getDB()
        .prepare(`UPDATE games SET ${sets.join(", ")} WHERE id = ?`)
        .run(...params);
    }
    return this.getById(id);
  },

  /** Removes the game from the user's library. Only unlinks — never deletes the game record. */
  remove(userId: string, id: string): void {
    // Users only modify their own library state — game records are managed through Backstage.
    stmt(`DELETE FROM library_games WHERE library_id = ${LIBRARY_SQ} AND game_id = ?`).run(
      userId,
      id,
    );
  },

  /** Permanently deletes a game and all associated data. Refuses to delete published games. */
  destroy(id: string): void {
    const game = this.getById(id);
    if (!game) return;
    if (game.published) throw new Error("[Games.destroy] cannot delete a published game");

    const db = getDB();
    db.transaction(() => {
      // playlist_track_decisions has no FK cascade — clean up explicitly
      stmt("DELETE FROM playlist_track_decisions WHERE game_id = ?").run(id);
      // FK cascades handle: library_games, tracks, video_tracks, game_review_flags, playlist_tracks
      stmt("DELETE FROM games WHERE id = ?").run(id);
    })();
  },

  ensureExists(userId: string, id: string, title: string): void {
    const exists = stmt("SELECT id FROM games WHERE id = ?").get(id);
    if (!exists) {
      this.create(userId, id, title, CurationMode.Skip);
    } else {
      this.linkToLibrary(userId, id, CurationMode.Skip);
    }
  },

  /**
   * Returns all games with aggregate track statistics — used by the Backstage Game Index.
   * Not scoped to a user — backstage sees all games.
   */
  listWithTrackStats(): BackstageGame[] {
    const rows = stmt(`
      SELECT
        g.id, g.title, g.onboarding_phase, g.published, g.tracklist_source, g.needs_review,
        COUNT(t.name)                                               AS track_count,
        COUNT(t.tagged_at)                                         AS tagged_count,
        SUM(CASE WHEN t.active = 1 THEN 1 ELSE 0 END)             AS active_count,
        (SELECT COUNT(*) FROM game_review_flags f WHERE f.game_id = g.id) AS review_flag_count
      FROM games g
      LEFT JOIN tracks t ON t.game_id = g.id
      GROUP BY g.id
      ORDER BY review_flag_count DESC, g.title ASC
    `).all() as Record<string, unknown>[];

    return rows.map(toBackstageGame);
  },

  /**
   * Filtered search for the Backstage Game Index — returns games matching the given criteria.
   * All parameters are optional; omitting all returns up to 100 results ordered by title.
   */
  searchWithStats(filters: {
    title?: string;
    phase?: string;
    needsReview?: boolean;
    published?: boolean;
  }): BackstageGame[] {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filters.title) {
      clauses.push("g.title LIKE ?");
      params.push(`%${filters.title}%`);
    }
    if (filters.phase) {
      clauses.push("g.onboarding_phase = ?");
      params.push(filters.phase);
    }
    if (filters.needsReview !== undefined) {
      clauses.push("g.needs_review = ?");
      params.push(filters.needsReview ? 1 : 0);
    }
    if (filters.published !== undefined) {
      clauses.push("g.published = ?");
      params.push(filters.published ? 1 : 0);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const sql = `
      SELECT
        g.id, g.title, g.onboarding_phase, g.published, g.tracklist_source, g.needs_review,
        COUNT(t.name)                                               AS track_count,
        COUNT(t.tagged_at)                                         AS tagged_count,
        SUM(CASE WHEN t.active = 1 THEN 1 ELSE 0 END)             AS active_count,
        (SELECT COUNT(*) FROM game_review_flags f WHERE f.game_id = g.id) AS review_flag_count
      FROM games g
      LEFT JOIN tracks t ON t.game_id = g.id
      ${where}
      GROUP BY g.id
      ORDER BY review_flag_count DESC, g.title ASC
      LIMIT 100
    `;
    const rows = getDB()
      .prepare(sql)
      .all(...params) as Record<string, unknown>[];
    return rows.map(toBackstageGame);
  },

  /**
   * Bulk-inserts Steam games as disabled (curation='skip') into the user's library.
   * Silently skips entries whose steam_appid already exists (via the unique index).
   * Returns the count of newly inserted and skipped rows.
   */

  /** Returns aggregate counts for the Backstage dashboard. */
  dashboardCounts(): {
    phase: string;
    count: number;
    publishedCount: number;
    needsReviewCount: number;
  }[] {
    return stmt(`
      SELECT
        onboarding_phase AS phase,
        COUNT(*)                                                AS count,
        SUM(CASE WHEN published = 1 THEN 1 ELSE 0 END)        AS publishedCount,
        SUM(CASE WHEN needs_review = 1 THEN 1 ELSE 0 END)     AS needsReviewCount
      FROM games
      GROUP BY onboarding_phase
    `).all() as {
      phase: string;
      count: number;
      publishedCount: number;
      needsReviewCount: number;
    }[];
  },

  bulkImportSteam(
    userId: string,
    games: SteamGameInput[],
  ): { imported: number; skipped: number; importedIds: string[] } {
    const db = getDB();
    const insertGameSQL = `
      INSERT OR IGNORE INTO games
        (id, title, steam_appid, thumbnail_url)
      VALUES (?, ?, ?, ?)
    `;
    const insertLibrarySQL = `INSERT OR IGNORE INTO library_games (library_id, game_id, curation) VALUES (${LIBRARY_SQ}, ?, 'skip')`;

    let imported = 0;
    let skipped = 0;
    const importedIds: string[] = [];

    db.transaction(() => {
      for (const g of games) {
        const id = newId();
        const result = stmt(insertGameSQL).run(id, g.name, g.appid, steamHeaderUrl(g.appid));
        if (result.changes > 0) {
          imported++;
          importedIds.push(id);
          stmt(insertLibrarySQL).run(userId, id);
        } else {
          skipped++;
        }
      }
    })();

    return { imported, skipped, importedIds };
  },
};
