import { OnboardingPhase, ReviewReason } from "@/types";
import type { Game } from "@/types";
import { Games, BackstageGames, Tracks, VideoTracks, ReviewFlags } from "@/lib/db/repo";
import { GAME_MAX_TRACKS } from "@/lib/constants";
import {
  searchGameSoundtrack,
  fetchDiscogsRelease,
  fetchDiscogsMaster,
} from "@/lib/services/discogs";
import { fetchPlaylistItems } from "@/lib/services/youtube";
import { tagTracks } from "@/lib/pipeline/tagger";
import { resolveTracksToVideos } from "@/lib/pipeline/resolver";
import { discoverOSTPlaylist, ensureVideoMetadata } from "@/lib/pipeline/youtube-resolve";
import { getTaggingProvider } from "@/lib/llm";

// ─── Phase 1: Load Tracks ────────────────────────────────────────────────────

/**
 * Fetches the game's soundtrack from Discogs and upserts tracks into the DB.
 * Does NOT tag. Sets phase to TracksLoaded on success.
 * Returns null if no Discogs data was found (flags for review).
 */
export async function loadTracks(
  game: Game,
  onProgress?: (message: string) => void,
): Promise<{ trackCount: number } | null> {
  // Re-fetch game to get the latest tracklist_source (admin may have edited it)
  const fresh = Games.getById(game.id);
  const source = fresh?.tracklist_source ?? game.tracklist_source;
  const match = source?.match(/^(discogs-release|discogs-master|vgmdb):(\d+)$/);
  const sourceType = match?.[1];
  const sourceId = match?.[2];
  let result: Awaited<ReturnType<typeof searchGameSoundtrack>>;
  let wasPreset = false;

  if (sourceType === "discogs-release" && sourceId) {
    onProgress?.(`Fetching Discogs release ${sourceId}…`);
    result = await fetchDiscogsRelease(Number(sourceId));
    wasPreset = true;
  } else if (sourceType === "discogs-master" && sourceId) {
    onProgress?.(`Fetching Discogs master ${sourceId}…`);
    result = await fetchDiscogsMaster(Number(sourceId));
    wasPreset = true;
  } else if (sourceType === "vgmdb" && sourceId) {
    // TODO: implement VGMDB fetching
    onProgress?.(`VGMDB source (${sourceId}) — not yet supported`);
    ReviewFlags.markAsNeedsReview(
      game.id,
      ReviewReason.NoTracklistSource,
      `vgmdb:${sourceId} not supported yet`,
    );
    return null;
  } else {
    onProgress?.(`Searching Discogs for "${game.title}"…`);
    result = await searchGameSoundtrack(game.title);
  }

  if (!result) {
    const detail = wasPreset
      ? `Configured source "${source}" returned no usable tracks — verify the ID is correct`
      : undefined;
    ReviewFlags.markAsNeedsReview(game.id, ReviewReason.NoTracklistSource, detail);
    return null;
  }

  const { tracks, releaseId } = result;
  const capped = tracks.slice(0, GAME_MAX_TRACKS);
  if (tracks.length > GAME_MAX_TRACKS) {
    onProgress?.(`Found ${tracks.length} tracks, capping at ${GAME_MAX_TRACKS}…`);
  } else {
    onProgress?.(`Found ${capped.length} tracks…`);
  }

  Tracks.upsertBatch(
    capped.map((t) => ({
      gameId: game.id,
      name: t.name,
      position: t.position,
      durationSeconds: t.durationSeconds,
    })),
  );

  // Only set tracklist_source if it was discovered (not admin-preset)
  if (!wasPreset) {
    BackstageGames.update(game.id, { tracklist_source: `${result.sourceType}:${releaseId}` });
  }
  BackstageGames.setPhase(game.id, OnboardingPhase.TracksLoaded);

  return { trackCount: tracks.length };
}

// ─── Phase 2: Tag ────────────────────────────────────────────────────────────

/**
 * Runs the LLM tagger on existing untagged tracks.
 * Sets phase to Tagged on completion.
 */
export async function tagGameTracks(
  game: Game,
  onProgress?: (message: string) => void,
  signal?: AbortSignal,
): Promise<{ tagged: number; needsReview: boolean }> {
  const dbTracks = Tracks.getByGame(game.id);
  onProgress?.(`Tagging ${dbTracks.length} tracks…`);

  const provider = getTaggingProvider();
  await tagTracks(game.id, game.title, dbTracks, provider, signal);
  BackstageGames.setPhase(game.id, OnboardingPhase.Tagged);

  const afterTracks = Tracks.getByGame(game.id);
  const tagged = afterTracks.filter((t) => t.taggedAt !== null).length;
  const updatedGame = Games.getById(game.id);

  return { tagged, needsReview: !!updatedGame?.needs_review };
}

// ─── Phase 3: Resolve Videos ─────────────────────────────────────────────────

/**
 * Discovers the YouTube OST playlist, fetches items, resolves tracks to video IDs,
 * and caches video metadata. Sets phase to Resolved on completion.
 */
export async function resolveVideos(
  game: Game,
  onProgress?: (message: string) => void,
  signal?: AbortSignal,
): Promise<{ resolved: number; total: number }> {
  const playlistId = await discoverOSTPlaylist(game, onProgress);
  if (!playlistId) {
    throw new Error(`No YouTube OST playlist found for "${game.title}"`);
  }

  if (signal?.aborted) throw new Error("Cancelled");

  onProgress?.("Fetching playlist items…");
  const playlistItems = await fetchPlaylistItems(playlistId);

  const allTracks = Tracks.getByGame(game.id);
  onProgress?.(`Resolving ${allTracks.length} tracks to videos…`);

  const provider = getTaggingProvider();
  const resolved = await resolveTracksToVideos(game, allTracks, playlistItems, provider, signal);

  // Fetch metadata for ALL resolved video IDs (including auto-discovered inactive tracks)
  onProgress?.("Fetching video metadata…");
  const allVideoIds = [...VideoTracks.getTrackToVideo(game.id).values()];
  await ensureVideoMetadata(allVideoIds, game.id);

  BackstageGames.setPhase(game.id, OnboardingPhase.Resolved);

  return { resolved: resolved.length, total: allTracks.length };
}

// ─── Quick Onboard ───────────────────────────────────────────────────────────

/**
 * Chains all phases: loadTracks → tagGameTracks → resolveVideos → publish.
 */
export async function quickOnboard(
  game: Game,
  onProgress?: (message: string, current?: number, total?: number) => void,
  signal?: AbortSignal,
): Promise<{ trackCount: number; tagged: number; resolved: number }> {
  onProgress?.("Phase 1: Loading tracks…", 0, 3);
  const loaded = await loadTracks(game, (msg) => onProgress?.(msg, 0, 3));
  if (!loaded) {
    BackstageGames.setPhase(game.id, OnboardingPhase.Failed);
    throw new Error(`No Discogs data for "${game.title}"`);
  }

  if (signal?.aborted) throw new Error("Cancelled");

  onProgress?.("Phase 2: Tagging tracks…", 1, 3);
  const tagResult = await tagGameTracks(game, (msg) => onProgress?.(msg, 1, 3), signal);

  if (signal?.aborted) throw new Error("Cancelled");

  onProgress?.("Phase 3: Resolving videos…", 2, 3);
  const resolveResult = await resolveVideos(game, (msg) => onProgress?.(msg, 2, 3), signal);

  BackstageGames.setPublished(game.id, true);
  onProgress?.("Published.", 3, 3);

  return {
    trackCount: loaded.trackCount,
    tagged: tagResult.tagged,
    resolved: resolveResult.resolved,
  };
}
