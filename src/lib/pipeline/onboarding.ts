import { TaggingStatus, ReviewReason } from "@/types";
import type { Game, UserTier } from "@/types";
import { Games, Tracks, ReviewFlags } from "@/lib/db/repo";
import { searchGameSoundtrack } from "@/lib/services/discogs";
import { tagTracks } from "@/lib/pipeline/tagger";
import { getTaggingProvider } from "@/lib/llm";

export async function onboardGame(game: Game, tier: UserTier): Promise<void> {
  try {
    Games.setStatus(game.id, TaggingStatus.Indexing);

    const result = await searchGameSoundtrack(game.title);

    if (result) {
      const { tracks, releaseId } = result;

      Tracks.upsertBatch(
        tracks.map((t) => ({
          gameId: game.id,
          name: t.name,
          position: t.position,
          durationSeconds: t.durationSeconds,
        })),
      );

      const dbTracks = Tracks.getByGame(game.id);
      const provider = getTaggingProvider(tier);
      await tagTracks(game.id, game.title, dbTracks, provider);

      Games.update(game.id, { tracklist_source: `discogs:${releaseId}` });
      Games.setStatus(game.id, TaggingStatus.Ready);
      console.warn(`[onboard] ${game.title}: ${tracks.length} tracks from Discogs, tagged`);
    } else {
      ReviewFlags.markAsNeedsReview(game.id, ReviewReason.NoDiscogsData);
      Games.setStatus(game.id, TaggingStatus.Limited);
      console.warn(`[onboard] No Discogs data for "${game.title}", falling back to legacy path`);
    }
  } catch (err) {
    Games.setStatus(game.id, TaggingStatus.Failed);
    console.error(`[onboard] Failed for "${game.title}":`, err);
  }
}
