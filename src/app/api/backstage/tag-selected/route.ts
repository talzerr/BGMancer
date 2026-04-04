import { BackstageGames, Games, Tracks, VideoTracks } from "@/lib/db/repo";
import { tagTracks } from "@/lib/pipeline/onboarding/tagger";
import { getTaggingProvider } from "@/lib/llm";
import { makeSSEStream, SSE_HEADERS, sanitizeErrorMessage } from "@/lib/sse";
import { DiscoveredStatus, OnboardingPhase, SSEEventType } from "@/types";
import { createLogger } from "@/lib/logger";
import { assertBackstageAuth } from "@/lib/services/cloudflare-access";

const log = createLogger("backstage-tag-selected");

type TagSelectedEvent =
  | { type: SSEEventType.Progress; current: number; total: number; trackName: string }
  | { type: SSEEventType.Done; tagged: number; needsReview: number }
  | { type: SSEEventType.Error; message: string };

/** POST /api/backstage/tag-selected — tag only the specified tracks (no clearing) */
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
  const { stream, send, close } = makeSSEStream<TagSelectedEvent>();

  req.signal.addEventListener("abort", () => abort.abort());

  (async () => {
    try {
      const allTracks = await Tracks.getByGame(gameId);
      const resolvedMap = await VideoTracks.getTrackToVideo(gameId);
      const nameSet = new Set(trackNames);

      // Filter to requested tracks that are taggable:
      // - in the requested set
      // - have a video mapping
      // - not rejected or pending discovered
      const taggable = allTracks.filter(
        (t) =>
          nameSet.has(t.name) &&
          resolvedMap.has(t.name) &&
          (t.discovered === null || t.discovered === DiscoveredStatus.Approved),
      );

      // Clear existing tags so tagTracks() will re-process them
      const taggableNames = taggable.map((t) => t.name);
      if (taggableNames.length > 0) {
        await Tracks.clearTags(gameId, taggableNames);
      }

      // Null out taggedAt in memory so tagTracks sees them as untagged
      const freshTaggable = taggable.map((t) => ({ ...t, taggedAt: null }));

      send({
        type: SSEEventType.Progress,
        current: 0,
        total: freshTaggable.length,
        trackName: freshTaggable[0]?.name ?? "",
      });

      const provider = getTaggingProvider();
      await tagTracks(
        gameId,
        game.title,
        freshTaggable,
        provider,
        abort.signal,
        (current, total, trackName) =>
          send({ type: SSEEventType.Progress, current, total, trackName }),
      );

      // Count results: previously tagged tracks (not in our set) + newly tagged
      const taggableNameSet = new Set(taggableNames);
      const previouslyTagged = allTracks.filter(
        (t) => t.taggedAt !== null && !taggableNameSet.has(t.name),
      ).length;
      const tagged = previouslyTagged + freshTaggable.length;

      // Advance phase to Tagged if all eligible tracks are now tagged
      const allEligible = allTracks.filter(
        (t) => t.discovered === null || t.discovered === DiscoveredStatus.Approved,
      );
      const untaggedRemaining = allEligible.filter(
        (t) => t.taggedAt === null && !taggableNameSet.has(t.name),
      ).length;
      if (untaggedRemaining === 0 && tagged > 0) {
        await BackstageGames.setPhase(gameId, OnboardingPhase.Tagged);
      }

      const updatedGame = await Games.getById(gameId);
      const needsReview = updatedGame?.needs_review ? 1 : 0;

      send({ type: SSEEventType.Done, tagged, needsReview });
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
