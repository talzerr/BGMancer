import { getDB } from "@/lib/db";
import { selectTracksFromList, compilationQueries } from "@/lib/llm";
import { searchOSTPlaylist, fetchPlaylistItems, findBestVideo, YouTubeQuotaError } from "@/lib/youtube";
import type { Game, PlaylistTrack } from "@/types";

// ── SSE helpers ──────────────────────────────────────────────────────────────

export type GenerateEvent =
  | { type: "progress"; gameId?: string; title?: string; status?: "active" | "done" | "error"; message: string }
  | { type: "done"; tracks: PlaylistTrack[]; count: number; found: number; pending: number }
  | { type: "error"; message: string; detail?: string };

function makeStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const send = (event: GenerateEvent) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };

  const close = () => controller.close();

  return { stream, send, close };
}

// ── Route handler ────────────────────────────────────────────────────────────

/**
 * POST /api/playlist/generate
 *
 * Streams Server-Sent Events while building the playlist so the UI can show
 * live per-game progress. Ends with a `done` event containing all tracks and
 * an AI-written playlist summary.
 */
export async function POST() {
  const { stream, send, close } = makeStream();

  // Run the full pipeline asynchronously after returning the streaming Response
  (async () => {
    try {
      const db = getDB();

      const games = db
        .prepare("SELECT * FROM games ORDER BY created_at ASC")
        .all() as Game[];

      if (games.length === 0) {
        send({ type: "error", message: "Add at least one game before generating a playlist." });
        return;
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

      // ── Per-game track generation ─────────────────────────────────────────

      type GameTracks = {
        game: Game;
        tracks: Array<Omit<PlaylistTrack, "position" | "created_at">>;
      };

      const perGame: GameTracks[] = [];

      for (let gi = 0; gi < games.length; gi++) {
        const game = games[gi];

        if (game.allow_full_ost) {
          send({ type: "progress", gameId: game.id, title: game.title, status: "active", message: "Finding full OST compilation…" });
          const queries = compilationQueries(game.title, game.vibe_preference);
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
              search_queries: queries,
              status: "pending",
              error_message: null,
            }],
          });
          send({ type: "progress", gameId: game.id, title: game.title, status: "done", message: "Queued for YouTube search" });
          continue;
        }

        const individualIdx = individualGames.indexOf(game);
        const count = tracksPerGame + (individualIdx < remainder ? 1 : 0);

        try {
          send({ type: "progress", gameId: game.id, title: game.title, status: "active", message: "Searching YouTube for OST playlist…" });
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
            send({ type: "progress", gameId: game.id, title: game.title, status: "done", message: "No playlist found — queued for search" });
            continue;
          }

          send({ type: "progress", gameId: game.id, title: game.title, status: "active", message: "Fetching track list…" });
          const playlistTracks = await fetchPlaylistItems(playlistId);

          if (playlistTracks.length === 0) {
            perGame.push({ game, tracks: [] });
            send({ type: "progress", gameId: game.id, title: game.title, status: "done", message: "No tracks found" });
            continue;
          }

          send({ type: "progress", gameId: game.id, title: game.title, status: "active", message: `AI selecting ${count} from ${playlistTracks.length} tracks…` });
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

          send({ type: "progress", gameId: game.id, title: game.title, status: "done", message: `${selectedIndices.length} tracks selected` });
        } catch (err) {
          // Quota exhausted — abort the entire generation immediately
          if (err instanceof YouTubeQuotaError) throw err;

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
          send({ type: "progress", gameId: game.id, title: game.title, status: "error", message: err instanceof Error ? err.message : "Failed" });
        }
      }

      // ── Interleave tracks across games ───────────────────────────────────

      const columns = perGame.map((g) => g.tracks);
      const interleaved: GameTracks["tracks"] = [];
      const maxLen = Math.max(...columns.map((c) => c.length), 0);

      for (let i = 0; i < maxLen; i++) {
        for (const col of columns) {
          if (i < col.length) interleaved.push(col[i]);
        }
      }

      // ── Persist ──────────────────────────────────────────────────────────

      send({ type: "progress", message: "Saving playlist…" });

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
            t.id, t.game_id, t.track_name, t.video_id, t.video_title,
            t.channel_title, t.thumbnail,
            t.search_queries ? JSON.stringify(t.search_queries) : null,
            position, t.status, t.error_message
          );
        }
      });

      persistAll();

      const inserted: PlaylistTrack[] = interleaved.map((t, position) => ({
        ...t,
        position,
        created_at: new Date().toISOString(),
      }));

      // ── Resolve full-OST pending slots ───────────────────────────────────

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
              inserted[idx] = { ...inserted[idx], status: "found", video_id: video.videoId, video_title: video.title, channel_title: video.channelTitle, thumbnail: video.thumbnail };
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

      // ── Done ─────────────────────────────────────────────────────────────

      send({ type: "done", tracks: inserted, count: inserted.length, found: foundCount, pending: pendingCount });
    } catch (err) {
      if (err instanceof YouTubeQuotaError) {
        console.error("[generate] YouTube quota exceeded — aborting");
        send({ type: "error", message: err.message });
      } else {
        console.error("[POST /api/playlist/generate]", err);
        send({ type: "error", message: "Generation failed", detail: err instanceof Error ? err.message : String(err) });
      }
    } finally {
      close();
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no", // disable nginx buffering if present
    },
  });
}
