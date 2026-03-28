import { getDB } from "@/lib/db";
import { stmt } from "./_shared";
import { toGames } from "@/lib/db/mappers";
import type { OnboardingPhase } from "@/types";
import type { Game } from "@/types";
import { newId } from "@/lib/uuid";
import { steamHeaderUrl } from "@/lib/constants";
import { Games } from "./games";

// ─── Backstage-specific types ────────────────────────────────────────────────

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

// ─── Admin / pipeline mutations ──────────────────────────────────────────────

export const BackstageGames = {
  /** Creates a game record without linking to any user library. */
  createDraft(title: string, steamAppid?: number | null): Game {
    const id = newId();
    const thumbnail = steamAppid ? steamHeaderUrl(steamAppid) : null;
    stmt("INSERT INTO games (id, title, steam_appid, thumbnail_url) VALUES (?, ?, ?, ?)").run(
      id,
      title,
      steamAppid ?? null,
      thumbnail,
    );
    const created = Games.getById(id);
    if (!created) throw new Error(`[BackstageGames.createDraft] game ${id} not found after INSERT`);
    return created;
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

  /** Returns published games for the catalog browser (user-facing, but admin-curated data). */
  listPublished(search?: string, limit?: number): Game[] {
    if (search?.trim()) {
      return toGames(
        stmt(
          "SELECT * FROM games WHERE published = 1 AND title LIKE ? ORDER BY title ASC LIMIT ?",
        ).all(`%${search.trim()}%`, limit ?? 15),
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
    return Games.getById(id);
  },

  /** Permanently deletes a game and all associated data. Refuses to delete published games. */
  destroy(id: string): void {
    const game = Games.getById(id);
    if (!game) return;
    if (game.published) throw new Error("[BackstageGames.destroy] cannot delete a published game");

    const db = getDB();
    db.transaction(() => {
      stmt("DELETE FROM playlist_track_decisions WHERE game_id = ?").run(id);
      stmt("DELETE FROM games WHERE id = ?").run(id);
    })();
  },

  // ─── Backstage read queries ──────────────────────────────────────────────

  /** All games with aggregate track statistics — Backstage Game Index. */
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

  /** Filtered search for the Backstage Game Index. */
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

  /** Aggregate counts by onboarding phase — Backstage dashboard. */
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
};
