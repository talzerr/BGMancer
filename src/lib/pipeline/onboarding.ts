import { TaggingStatus, ReviewReason } from "@/types";
import type { Game, UserTier } from "@/types";
import { Games, Tracks, ReviewFlags } from "@/lib/db/repo";
import { searchGameSoundtrack } from "@/lib/services/discogs";
import { tagTracks } from "@/lib/pipeline/tagger";
import { getTaggingProvider } from "@/lib/llm";
import { bus } from "@/lib/events";

function setStatus(gameId: string, status: TaggingStatus): void {
  Games.setStatus(gameId, status);
  bus.emit("game:status", { gameId, status });
}

/**
 * Fetches the game's soundtrack from Discogs, upserts tracks, and runs the LLM tagger.
 * Returns the number of tracks inserted, or null if no Discogs data was found.
 * The optional `onProgress` callback receives human-readable status messages.
 */
export async function ingestFromDiscogs(
  game: Game,
  tier: UserTier,
  onProgress?: (message: string) => void,
): Promise<{ trackCount: number } | null> {
  onProgress?.(`Searching Discogs for "${game.title}"…`);
  const result = await searchGameSoundtrack(game.title);
  if (!result) return null;

  const { tracks, releaseId } = result;
  onProgress?.(`Found ${tracks.length} tracks from Discogs…`);

  Tracks.upsertBatch(
    tracks.map((t) => ({
      gameId: game.id,
      name: t.name,
      position: t.position,
      durationSeconds: t.durationSeconds,
    })),
  );

  Games.update(game.id, { tracklist_source: `discogs:${releaseId}` });

  onProgress?.(`Tagging ${tracks.length} tracks…`);
  const dbTracks = Tracks.getByGame(game.id);
  const provider = getTaggingProvider(tier);
  await tagTracks(game.id, game.title, dbTracks, provider);

  return { trackCount: tracks.length };
}

export async function onboardGame(game: Game, tier: UserTier): Promise<void> {
  try {
    setStatus(game.id, TaggingStatus.Indexing);

    const result = await ingestFromDiscogs(game, tier);

    if (result) {
      setStatus(game.id, TaggingStatus.Ready);
      console.warn(`[onboard] ${game.title}: ${result.trackCount} tracks from Discogs, tagged`);
    } else {
      ReviewFlags.markAsNeedsReview(game.id, ReviewReason.NoDiscogsData);
      setStatus(game.id, TaggingStatus.Limited);
      console.warn(`[onboard] No Discogs data for "${game.title}", falling back to legacy path`);
    }
  } catch (err) {
    setStatus(game.id, TaggingStatus.Failed);
    console.error(`[onboard] Failed for "${game.title}":`, err);
  }
}
