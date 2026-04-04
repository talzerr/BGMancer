import { Games, Tracks, VideoTracks } from "@/lib/db/repo";
import { makeSSEStream, SSE_HEADERS, sanitizeErrorMessage } from "@/lib/sse";
import { resolveTracksToVideos } from "@/lib/pipeline/onboarding/resolver";
import {
  discoverOSTPlaylist,
  ensureVideoMetadata,
} from "@/lib/pipeline/onboarding/youtube-resolve";
import { fetchPlaylistItems } from "@/lib/services/youtube";
import { getTaggingProvider } from "@/lib/llm";
import { SSEEventType } from "@/types";
import { createLogger } from "@/lib/logger";
import { assertBackstageAuth } from "@/lib/services/cloudflare-access";

const log = createLogger("backstage-resolve-selected");

type ResolveSelectedEvent =
  | { type: SSEEventType.Progress; message: string }
  | { type: SSEEventType.Done; resolved: number; total: number }
  | { type: SSEEventType.Error; message: string };

/** POST /api/backstage/resolve-selected — resolve only the specified tracks to YouTube videos */
export async function POST(req: Request) {
  assertBackstageAuth(req);
  const { gameId, trackNames } = (await req.json()) as {
    gameId: string;
    trackNames: string[];
  };

  if (!gameId || !trackNames?.length) {
    return new Response(
      `data: ${JSON.stringify({ type: SSEEventType.Error, message: "gameId and trackNames are required" })}\n\n`,
      { headers: SSE_HEADERS },
    );
  }

  const game = await Games.getById(gameId);
  if (!game) {
    return new Response(
      `data: ${JSON.stringify({ type: SSEEventType.Error, message: "Game not found" })}\n\n`,
      { headers: SSE_HEADERS },
    );
  }

  const abort = new AbortController();
  const { stream, send, close } = makeSSEStream<ResolveSelectedEvent>();

  req.signal.addEventListener("abort", () => abort.abort());

  (async () => {
    try {
      const playlistId = await discoverOSTPlaylist(game, (message) =>
        send({ type: SSEEventType.Progress, message }),
      );
      if (!playlistId) {
        send({
          type: SSEEventType.Error,
          message: `No YouTube OST playlist found for "${game.title}"`,
        });
        return;
      }

      if (abort.signal.aborted) throw new Error("Cancelled");

      send({ type: SSEEventType.Progress, message: "Fetching playlist items…" });
      const playlistItems = await fetchPlaylistItems(playlistId);

      const allTracks = await Tracks.getByGame(gameId);
      const nameSet = new Set(trackNames);
      const selectedTracks = allTracks.filter((t) => nameSet.has(t.name));

      send({
        type: SSEEventType.Progress,
        message: `Resolving ${selectedTracks.length} tracks to videos…`,
      });

      const provider = getTaggingProvider();
      const resolved = await resolveTracksToVideos(
        game,
        selectedTracks,
        playlistItems,
        provider,
        abort.signal,
      );

      send({ type: SSEEventType.Progress, message: "Fetching video metadata…" });
      const allVideoIds = [...(await VideoTracks.getTrackToVideo(gameId)).values()];
      await ensureVideoMetadata(allVideoIds, gameId);

      send({ type: SSEEventType.Done, resolved: resolved.length, total: selectedTracks.length });
    } catch (err) {
      if (abort.signal.aborted) {
        send({ type: SSEEventType.Error, message: "Cancelled" });
      } else {
        log.error("handler failed", {}, err);
        send({
          type: SSEEventType.Error,
          message: sanitizeErrorMessage(err),
        });
      }
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}
