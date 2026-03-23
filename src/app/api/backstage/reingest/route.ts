import { Games, Tracks, ReviewFlags } from "@/lib/db/repo";
import { searchGameSoundtrack } from "@/lib/services/discogs";
import { tagTracks } from "@/lib/pipeline/tagger";
import { getTaggingProvider } from "@/lib/llm";
import { TaggingStatus, UserTier, ReviewReason } from "@/types";

type ReingestEvent =
  | { type: "progress"; message: string }
  | { type: "done"; trackCount: number; tagged: number; needsReview: number }
  | { type: "error"; message: string };

function makeStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const send = (event: ReingestEvent) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };
  const close = () => controller.close();

  return { stream, send, close };
}

/** POST /api/backstage/reingest — clear all tracks and re-fetch from Discogs */
export async function POST(req: Request) {
  const { gameId } = (await req.json()) as { gameId: string };

  if (!gameId) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "gameId is required" })}\n\n`,
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } },
    );
  }

  const game = Games.getById(gameId);
  if (!game) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Game not found" })}\n\n`,
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } },
    );
  }

  const { stream, send, close } = makeStream();

  (async () => {
    try {
      send({ type: "progress", message: "Clearing existing tracks…" });
      Tracks.deleteByGame(gameId);
      ReviewFlags.clearByGame(gameId);
      Games.setStatus(gameId, TaggingStatus.Indexing);

      send({ type: "progress", message: `Searching Discogs for "${game.title}"…` });
      const result = await searchGameSoundtrack(game.title);

      if (!result) {
        ReviewFlags.markAsNeedsReview(gameId, ReviewReason.NoDiscogsData);
        Games.setStatus(gameId, TaggingStatus.Limited);
        send({ type: "error", message: "No Discogs data found for this game." });
        return;
      }

      const { tracks, releaseId } = result;
      send({ type: "progress", message: `Found ${tracks.length} tracks from Discogs…` });

      Tracks.upsertBatch(
        tracks.map((t) => ({
          gameId: game.id,
          name: t.name,
          position: t.position,
          durationSeconds: t.durationSeconds,
        })),
      );

      Games.update(game.id, { tracklist_source: `discogs:${releaseId}` });

      send({ type: "progress", message: `Tagging ${tracks.length} tracks…` });
      const dbTracks = Tracks.getByGame(gameId);
      const provider = getTaggingProvider(UserTier.Maestro);
      await tagTracks(gameId, game.title, dbTracks, provider);

      Games.setStatus(gameId, TaggingStatus.Ready);

      const finalTracks = Tracks.getByGame(gameId);
      const tagged = finalTracks.filter((t) => t.taggedAt !== null).length;
      const updatedGame = Games.getById(gameId);
      const needsReview = updatedGame?.needs_review ? 1 : 0;

      send({ type: "done", trackCount: finalTracks.length, tagged, needsReview });
    } catch (err) {
      Games.setStatus(gameId, TaggingStatus.Failed);
      console.error("[POST /api/backstage/reingest]", err);
      send({ type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      close();
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
