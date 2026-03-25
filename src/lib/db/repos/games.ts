import { getDB } from "@/lib/db";
import { stmt, LIBRARY_SQ } from "./_shared";
import { toGame, toGames } from "@/lib/db/mappers";
import { CurationMode } from "@/types";
import type { OnboardingPhase } from "@/types";
import type { Game } from "@/types";
import { newId } from "@/lib/uuid";
import { YT_IMPORT_GAME_ID } from "@/lib/constants";

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
  tracklist_source?: string | null;
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
  /** Returns all non-skip games in the user's library — used for playlist generation. */
  listAll(userId: string, excludeId?: string): Game[] {
    const base = `
      SELECT g.*, lg.curation FROM games g
      JOIN library_games lg ON lg.game_id = g.id
      WHERE lg.library_id = ${LIBRARY_SQ}
        AND lg.curation != 'skip'
    `;
    if (excludeId) {
      return toGames(stmt(`${base} AND g.id != ? ORDER BY lg.added_at ASC`).all(userId, excludeId));
    }
    return toGames(stmt(`${base} ORDER BY lg.added_at ASC`).all(userId));
  },

  /** Returns all games in the user's library regardless of curation — used by the library page. */
  listAllIncludingDisabled(userId: string): Game[] {
    return toGames(
      stmt(`
        SELECT g.*, lg.curation FROM games g
        JOIN library_games lg ON lg.game_id = g.id
        WHERE lg.library_id = ${LIBRARY_SQ}
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
    playtimeMinutes: number | null = null,
  ): Game {
    const db = getDB();
    db.transaction(() => {
      stmt("INSERT INTO games (id, title, steam_appid, playtime_minutes) VALUES (?, ?, ?, ?)").run(
        id,
        title,
        steamAppid,
        playtimeMinutes,
      );

      stmt(
        `INSERT OR IGNORE INTO library_games (library_id, game_id, curation) VALUES (${LIBRARY_SQ}, ?, ?)`,
      ).run(userId, id, curation);
    })();

    const created = this.getByIdForUser(userId, id);
    if (!created) throw new Error(`[Games.create] game ${id} not found after INSERT`);
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

  listPublished(): Game[] {
    return toGames(stmt("SELECT * FROM games WHERE published = 1 ORDER BY title ASC").all());
  },

  update(id: string, fields: GameUpdateFields): Game | null {
    if (fields.tracklist_source !== undefined) {
      stmt(
        `UPDATE games SET tracklist_source = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
      ).run(fields.tracklist_source, id);
    }
    if (fields.needs_review !== undefined) {
      stmt(
        `UPDATE games SET needs_review = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
      ).run(fields.needs_review ? 1 : 0, id);
    }
    return this.getById(id);
  },

  /** Removes the game from the user's library (and deletes the game row if it has no other library entries). */
  remove(userId: string, id: string): void {
    const db = getDB();
    db.transaction(() => {
      stmt(`DELETE FROM library_games WHERE library_id = ${LIBRARY_SQ} AND game_id = ?`).run(
        userId,
        id,
      );
      const remaining = stmt("SELECT COUNT(*) AS cnt FROM library_games WHERE game_id = ?").get(
        id,
      ) as { cnt: number };
      if (remaining.cnt === 0) {
        stmt("DELETE FROM games WHERE id = ?").run(id);
      }
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
    if (filters.needsReview) {
      clauses.push("g.needs_review = 1");
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
  bulkImportSteam(
    userId: string,
    games: SteamGameInput[],
  ): { imported: number; skipped: number; importedIds: string[] } {
    const db = getDB();
    const insertGameSQL = `
      INSERT OR IGNORE INTO games
        (id, title, steam_appid, playtime_minutes)
      VALUES (?, ?, ?, ?)
    `;
    const insertLibrarySQL = `INSERT OR IGNORE INTO library_games (library_id, game_id, curation) VALUES (${LIBRARY_SQ}, ?, 'skip')`;

    let imported = 0;
    let skipped = 0;
    const importedIds: string[] = [];

    db.transaction(() => {
      for (const g of games) {
        const id = newId();
        const result = stmt(insertGameSQL).run(id, g.name, g.appid, Math.round(g.playtime_forever));
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
