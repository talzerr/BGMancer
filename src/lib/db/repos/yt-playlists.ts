import { stmt } from "./_shared";

export const YtPlaylists = {
  /**
   * Returns the effective playlist ID for a game.
   * Checks (in order): user override, global for this game_id, global by title.
   * Pass gameTitle to enable cross-user sharing for manually-added games.
   */
  get(gameId: string, userId: string, gameTitle?: string): string | null {
    // 1. User-specific override
    const userRow = stmt(
      "SELECT playlist_id FROM game_yt_playlists WHERE game_id = ? AND user_id = ?",
    ).get(gameId, userId) as { playlist_id: string } | undefined;
    if (userRow) return userRow.playlist_id;

    // 2. Global entry for this exact game_id
    const globalRow = stmt(
      "SELECT playlist_id FROM game_yt_playlists WHERE game_id = ? AND user_id = ''",
    ).get(gameId) as { playlist_id: string } | undefined;
    if (globalRow) return globalRow.playlist_id;

    // 3. Global entry for any game with the same title (cross-user sharing for manual games)
    if (gameTitle) {
      const titleRow = stmt(`
        SELECT yp.playlist_id FROM game_yt_playlists yp
        JOIN games g ON g.id = yp.game_id
        WHERE yp.user_id = '' AND g.title = ?
        LIMIT 1
      `).get(gameTitle) as { playlist_id: string } | undefined;
      if (titleRow) return titleRow.playlist_id;
    }

    return null;
  },

  /** Upserts a globally shared cache entry (auto-discovery, seed file). */
  upsert(gameId: string, playlistId: string): void {
    stmt(`
      INSERT INTO game_yt_playlists (game_id, user_id, playlist_id)
      VALUES (?, '', ?)
      ON CONFLICT(game_id, user_id) DO UPDATE SET
        playlist_id   = excluded.playlist_id,
        discovered_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    `).run(gameId, playlistId);
  },

  /** Upserts a per-user playlist override. Does not affect other users. */
  upsertForUser(gameId: string, userId: string, playlistId: string): void {
    stmt(`
      INSERT INTO game_yt_playlists (game_id, user_id, playlist_id)
      VALUES (?, ?, ?)
      ON CONFLICT(game_id, user_id) DO UPDATE SET
        playlist_id   = excluded.playlist_id,
        discovered_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    `).run(gameId, userId, playlistId);
  },

  /** Clears the user's personal override, falling back to the global cache. */
  clearForUser(gameId: string, userId: string): void {
    stmt("DELETE FROM game_yt_playlists WHERE game_id = ? AND user_id = ?").run(gameId, userId);
  },

  /** Clears the global shared entry for a game (dev use). */
  clearForGame(gameId: string): void {
    stmt("DELETE FROM game_yt_playlists WHERE game_id = ? AND user_id = ''").run(gameId);
  },

  /**
   * Returns a merged {game_id: playlist_id} map for a user.
   * User overrides take precedence over global entries.
   */
  listAllAsMap(userId: string): Record<string, string> {
    const rows = stmt(`
      SELECT game_id, playlist_id FROM game_yt_playlists WHERE user_id = ?
      UNION
      SELECT game_id, playlist_id FROM game_yt_playlists
      WHERE user_id = '' AND game_id NOT IN (
        SELECT game_id FROM game_yt_playlists WHERE user_id = ?
      )
    `).all(userId, userId) as Array<{ game_id: string; playlist_id: string }>;
    return Object.fromEntries(rows.map((r) => [r.game_id, r.playlist_id]));
  },

  /** Returns all global cached entries joined with game title — used for seed export. */
  listAll(): Array<{ game_title: string; playlist_id: string }> {
    return stmt(`
      SELECT g.title AS game_title, yp.playlist_id
      FROM game_yt_playlists yp
      JOIN games g ON g.id = yp.game_id
      WHERE yp.user_id = ''
      ORDER BY g.title ASC
    `).all() as Array<{ game_title: string; playlist_id: string }>;
  },

  /** Returns all entries (global + user overrides) for the dev panel. */
  loadRaw(): Array<{
    game_id: string;
    game_title: string;
    playlist_id: string;
    discovered_at: string;
    user_id: string;
  }> {
    return stmt(`
      SELECT yp.game_id, g.title AS game_title, yp.playlist_id, yp.discovered_at, yp.user_id
      FROM game_yt_playlists yp
      JOIN games g ON g.id = yp.game_id
      ORDER BY yp.discovered_at DESC
    `).all() as Array<{
      game_id: string;
      game_title: string;
      playlist_id: string;
      discovered_at: string;
      user_id: string;
    }>;
  },
};
