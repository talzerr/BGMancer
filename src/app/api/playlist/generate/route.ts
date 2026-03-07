import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { selectTracksFromList, compilationQueries } from "@/lib/llm";
import { searchOSTPlaylist, fetchPlaylistItems, findBestVideo } from "@/lib/youtube";
import type { Game, PlaylistTrack } from "@/types";

/**
 * POST /api/playlist/generate
 *
 * Pipeline for individual-track games:
 *   1. Search YouTube for the game's official OST *playlist*
 *   2. Fetch real track titles + video IDs from that playlist
 *   3. Ask the LLM to *select* N tracks from the real list (no hallucination possible)
 *   4. Insert selected tracks as status='found' (video IDs already known)
 *
 * Full-OST games still use the old search path (find a long compilation video)
 * and are inserted as status='pending' for the /search step.
 */
export async function POST() {
  try {
    const db = getDB();

    const games = db
      .prepare("SELECT * FROM games ORDER BY created_at ASC")
      .all() as Game[];

    if (games.length === 0) {
      return NextResponse.json(
        { error: "Add at least one game before generating a playlist." },
        { status: 400 }
      );
    }

    const configRows = db.prepare("SELECT key, value FROM config").all() as Array<{
      key: string;
      value: string;
    }>;
    const configMap = Object.fromEntries(configRows.map((r) => [r.key, r.value]));
    const targetCount = parseInt(configMap.target_track_count ?? "50", 10);

    const fullOSTGames = games.filter((g) => g.allow_full_ost);
    const individualGames = games.filter((g) => !g.allow_full_ost);

    const remainingSlots = Math.max(0, targetCount - fullOSTGames.length);
    const tracksPerGame =
      individualGames.length > 0
        ? Math.max(1, Math.floor(remainingSlots / individualGames.length))
        : 0;
    const remainder =
      individualGames.length > 0 ? remainingSlots % individualGames.length : 0;

    // ── Per-game track generation ────────────────────────────────────────────

    type GameTracks = {
      game: Game;
      tracks: Array<Omit<PlaylistTrack, "position" | "created_at">>;
    };

    const perGame: GameTracks[] = [];

    for (let gi = 0; gi < games.length; gi++) {
      const game = games[gi];

      if (game.allow_full_ost) {
        const queries = compilationQueries(game.title, game.vibe_preference);
        perGame.push({
          game,
          tracks: [
            {
              id: crypto.randomUUID(),
              game_id: game.id,
              game_title: game.title,
              track_name: null,
              video_id: null,
              video_title: null,
              channel_title: null,
              thumbnail: null,
              search_queries: queries,
              status: "pending",
              error_message: null,
            },
          ],
        });
        continue;
      }

      const individualIdx = individualGames.indexOf(game);
      const count = tracksPerGame + (individualIdx < remainder ? 1 : 0);

      try {
        const playlistId = await searchOSTPlaylist(game.title);

        if (!playlistId) {
          const queries = compilationQueries(game.title, game.vibe_preference);
          perGame.push({
            game,
            tracks: Array.from({ length: count }, () => ({
              id: crypto.randomUUID(),
              game_id: game.id,
              game_title: game.title,
              track_name: null,
              video_id: null,
              video_title: null,
              channel_title: null,
              thumbnail: null,
              search_queries: queries,
              status: "pending" as const,
              error_message: "No OST playlist found on YouTube — will search individually.",
            })),
          });
          continue;
        }

        const playlistTracks = await fetchPlaylistItems(playlistId);
        if (playlistTracks.length === 0) {
          perGame.push({ game, tracks: [] });
          continue;
        }

        const selectedIndices = await selectTracksFromList(
          game.title,
          game.vibe_preference,
          playlistTracks,
          Math.min(count, playlistTracks.length)
        );

        perGame.push({
          game,
          tracks: selectedIndices.map((idx) => {
            const t = playlistTracks[idx];
            return {
              id: crypto.randomUUID(),
              game_id: game.id,
              game_title: game.title,
              track_name: t.title,
              video_id: t.videoId,
              video_title: t.title,
              channel_title: t.channelTitle,
              thumbnail: t.thumbnail,
              search_queries: null,
              status: "found" as const,
              error_message: null,
            };
          }),
        });
      } catch (err) {
        console.error(`[generate] failed for game "${game.title}":`, err);
        perGame.push({
          game,
          tracks: [
            {
              id: crypto.randomUUID(),
              game_id: game.id,
              game_title: game.title,
              track_name: null,
              video_id: null,
              video_title: null,
              channel_title: null,
              thumbnail: null,
              search_queries: null,
              status: "error" as const,
              error_message: err instanceof Error ? err.message : "Generation failed",
            },
          ],
        });
      }
    }

    // ── Interleave tracks across games ───────────────────────────────────────

    const columns = perGame.map((g) => g.tracks);
    const interleaved: GameTracks["tracks"] = [];
    const maxLen = Math.max(...columns.map((c) => c.length), 0);

    for (let i = 0; i < maxLen; i++) {
      for (const col of columns) {
        if (i < col.length) interleaved.push(col[i]);
      }
    }

    // ── Persist — wrapped in a transaction for speed ─────────────────────────

    const insertStmt = db.prepare(`
      INSERT INTO playlist_tracks
        (id, game_id, track_name, video_id, video_title, channel_title, thumbnail,
         search_queries, position, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const persistAll = db.transaction(() => {
      db.prepare("DELETE FROM playlist_tracks").run();
      for (let position = 0; position < interleaved.length; position++) {
        const t = interleaved[position];
        insertStmt.run(
          t.id,
          t.game_id,
          t.track_name,
          t.video_id,
          t.video_title,
          t.channel_title,
          t.thumbnail,
          t.search_queries ? JSON.stringify(t.search_queries) : null,
          position,
          t.status,
          t.error_message
        );
      }
    });

    persistAll();

    const inserted: PlaylistTrack[] = interleaved.map((t, position) => ({
      ...t,
      position,
      created_at: new Date().toISOString(),
    }));

    // ── Immediately resolve full-OST pending slots ────────────────────────────

    const updateFound = db.prepare(`
      UPDATE playlist_tracks
      SET status='found', video_id=?, video_title=?, channel_title=?, thumbnail=?, error_message=NULL
      WHERE id=?
    `);
    const updateError = db.prepare(
      "UPDATE playlist_tracks SET status='error', error_message=? WHERE id=?"
    );

    const pendingTracks = inserted.filter((t) => t.status === "pending" && t.search_queries);
    for (const track of pendingTracks) {
      try {
        const video = await findBestVideo(track.search_queries!, false);
        if (video) {
          updateFound.run(video.videoId, video.title, video.channelTitle, video.thumbnail, track.id);
          const idx = inserted.findIndex((t) => t.id === track.id);
          if (idx !== -1) {
            inserted[idx] = {
              ...inserted[idx],
              status: "found",
              video_id: video.videoId,
              video_title: video.title,
              channel_title: video.channelTitle,
              thumbnail: video.thumbnail,
            };
          }
        } else {
          updateError.run("No suitable compilation video found.", track.id);
        }
      } catch {
        // Leave as pending — user can retry via /search
      }
    }

    const foundCount = inserted.filter((t) => t.status === "found").length;
    const pendingCount = inserted.filter((t) => t.status === "pending").length;

    return NextResponse.json({
      tracks: inserted,
      count: inserted.length,
      found: foundCount,
      pending: pendingCount,
    });
  } catch (err) {
    console.error("[POST /api/playlist/generate]", err);
    return NextResponse.json(
      {
        error: "Generation failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
