import { OnboardingPhase, ReviewReason } from "@/types";
import type { Game } from "@/types";
import { Games, Tracks, ReviewFlags } from "@/lib/db/repo";
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
import { bus } from "@/lib/events";

function emitPhase(gameId: string, phase: OnboardingPhase): void {
  Games.setPhase(gameId, phase);
  bus.emit("game:status", { gameId, phase });
}

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
    ReviewFlags.markAsNeedsReview(game.id, ReviewReason.NoTracklistSource);
    return null;
  }

  const { tracks, releaseId } = result;
  onProgress?.(`Found ${tracks.length} tracks…`);

  Tracks.upsertBatch(
    tracks.map((t) => ({
      gameId: game.id,
      name: t.name,
      position: t.position,
      durationSeconds: t.durationSeconds,
    })),
  );

  // Only set tracklist_source if it was discovered (not admin-preset)
  if (!wasPreset) {
    Games.update(game.id, { tracklist_source: `${result.sourceType}:${releaseId}` });
  }
  emitPhase(game.id, OnboardingPhase.TracksLoaded);

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
): Promise<{ tagged: number; needsReview: boolean }> {
  const dbTracks = Tracks.getByGame(game.id);
  onProgress?.(`Tagging ${dbTracks.length} tracks…`);

  const provider = getTaggingProvider();
  await tagTracks(game.id, game.title, dbTracks, provider);
  emitPhase(game.id, OnboardingPhase.Tagged);

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
): Promise<{ resolved: number; total: number }> {
  const playlistId = await discoverOSTPlaylist(game, onProgress);
  if (!playlistId) {
    throw new Error(`No YouTube OST playlist found for "${game.title}"`);
  }

  onProgress?.("Fetching playlist items…");
  const playlistItems = await fetchPlaylistItems(playlistId);

  const allTracks = Tracks.getByGame(game.id);
  onProgress?.(`Resolving ${allTracks.length} tracks to videos…`);

  const provider = getTaggingProvider();
  const resolved = await resolveTracksToVideos(game, allTracks, playlistItems, provider);

  onProgress?.("Fetching video metadata…");
  await ensureVideoMetadata(
    resolved.map((r) => r.videoId),
    game.id,
  );

  emitPhase(game.id, OnboardingPhase.Resolved);

  return { resolved: resolved.length, total: allTracks.length };
}

// ─── Quick Onboard ───────────────────────────────────────────────────────────

/**
 * Chains all phases: loadTracks → tagGameTracks → resolveVideos → publish.
 */
export async function quickOnboard(
  game: Game,
  onProgress?: (message: string) => void,
): Promise<{ trackCount: number; tagged: number; resolved: number }> {
  onProgress?.("Phase 1: Loading tracks…");
  const loaded = await loadTracks(game, onProgress);
  if (!loaded) {
    emitPhase(game.id, OnboardingPhase.Failed);
    throw new Error(`No Discogs data for "${game.title}"`);
  }

  onProgress?.("Phase 2: Tagging tracks…");
  const tagResult = await tagGameTracks(game, onProgress);

  onProgress?.("Phase 3: Resolving videos…");
  const resolveResult = await resolveVideos(game, onProgress);

  Games.setPublished(game.id, true);
  onProgress?.("Published.");

  return {
    trackCount: loaded.trackCount,
    tagged: tagResult.tagged,
    resolved: resolveResult.resolved,
  };
}

// ─── Backward-compat wrappers ────────────────────────────────────────────────

/**
 * Fetches the game's soundtrack from Discogs, upserts tracks, and runs the LLM tagger.
 * Thin wrapper around loadTracks + tagGameTracks for backward compatibility.
 */
export async function ingestFromDiscogs(
  game: Game,
  onProgress?: (message: string) => void,
): Promise<{ trackCount: number } | null> {
  const loaded = await loadTracks(game, onProgress);
  if (!loaded) return null;
  await tagGameTracks(game, onProgress);
  return loaded;
}

/** Background onboarding entry point — delegates to quickOnboard. */
export async function onboardGame(game: Game): Promise<void> {
  try {
    emitPhase(game.id, OnboardingPhase.Draft);
    await quickOnboard(game);
    console.warn(`[onboard] ${game.title}: quick onboard complete`);
  } catch (err) {
    emitPhase(game.id, OnboardingPhase.Failed);
    console.error(`[onboard] Failed for "${game.title}":`, err);
  }
}
