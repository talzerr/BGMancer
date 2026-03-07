import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "@/lib/db";
import { selectTracksFromList, compilationQueries } from "@/lib/llm";
import { searchOSTPlaylist, fetchPlaylistItems, findBestVideo } from "@/lib/youtube";
import type { Game, PlaylistTrack } from "@/types";

/**
 * POST /api/playlist/generate
 *
 * New pipeline for individual-track games:
 *   1. Search YouTube for the game's official OST *playlist*
 *   2. Fetch real track titles + video IDs from that playlist
 *   3. Ask the LLM to *select* N tracks from the real list (no hallucination possible)
 *   4. Insert selected tracks as status='found' (video IDs already known)
 *
 * Full-OST games still use the old search path (find a long compilation video)
 * and are inserted as status='pending' for the /search step.
 *
 * Result: individual tracks are immediately playable after generation;
 * only full-OST slots need a separate YouTube search.
 */
export async function POST() {
  try {
    const db = getPool();

    const [gameRows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM games ORDER BY created_at ASC"
    );
    const games = gameRows as Game[];

    if (games.length === 0) {
      return NextResponse.json(
        { error: "Add at least one game before generating a playlist." },
        { status: 400 }
      );
    }

    const [configRows] = await db.query<RowDataPacket[]>(
      "SELECT `key`, value FROM config"
    );
    const configMap = Object.fromEntries(
      configRows.map((r) => [r.key as string, r.value as string])
    );
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
        // Full-OST slot — search for long compilation, inserted as pending
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

      // Individual-track mode
      const individualIdx = individualGames.indexOf(game);
      const count = tracksPerGame + (individualIdx < remainder ? 1 : 0);

      try {
        // Step 1: find the OST playlist on YouTube
        const playlistId = await searchOSTPlaylist(game.title);

        if (!playlistId) {
          // No playlist found — fall back to pending (will be searched individually)
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

        // Step 2: fetch real tracks from the playlist
        const playlistTracks = await fetchPlaylistItems(playlistId);

        if (playlistTracks.length === 0) {
          perGame.push({ game, tracks: [] });
          continue;
        }

        // Step 3: LLM selects indices from the real list
        const selectedIndices = await selectTracksFromList(
          game.title,
          game.vibe_preference,
          playlistTracks,
          Math.min(count, playlistTracks.length)
        );

        // Step 4: map to full track objects — status='found', video IDs already known
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
          tracks: [{
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
          }],
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

    // ── Persist ──────────────────────────────────────────────────────────────

    await db.query<ResultSetHeader>("DELETE FROM playlist_tracks");

    const inserted: PlaylistTrack[] = [];

    for (let position = 0; position < interleaved.length; position++) {
      const track = interleaved[position];
      await db.query<ResultSetHeader>(
        `INSERT INTO playlist_tracks
          (id, game_id, track_name, video_id, video_title, channel_title, thumbnail,
           search_queries, position, status, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          track.id,
          track.game_id,
          track.track_name,
          track.video_id,
          track.video_title,
          track.channel_title,
          track.thumbnail,
          track.search_queries ? JSON.stringify(track.search_queries) : null,
          position,
          track.status,
          track.error_message,
        ]
      );
      inserted.push({ ...track, position, created_at: new Date().toISOString() });
    }

    // ── Immediately resolve full-OST pending slots ────────────────────────────
    // Run these in the background after responding so the UI isn't blocked.
    // For now, do them synchronously but we'll make this async in the future.
    const pendingTracks = inserted.filter((t) => t.status === "pending" && t.search_queries);
    for (const track of pendingTracks) {
      try {
        const video = await findBestVideo(track.search_queries!, false);
        if (video) {
          await db.query<ResultSetHeader>(
            `UPDATE playlist_tracks
             SET status='found', video_id=?, video_title=?, channel_title=?, thumbnail=?, error_message=NULL
             WHERE id=?`,
            [video.videoId, video.title, video.channelTitle, video.thumbnail, track.id]
          );
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
          await db.query<ResultSetHeader>(
            "UPDATE playlist_tracks SET status='error', error_message=? WHERE id=?",
            ["No suitable compilation video found.", track.id]
          );
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
