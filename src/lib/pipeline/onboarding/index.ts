import { OnboardingPhase, ReviewReason, DiscoveredStatus, TracklistSource } from "@/types";
import type { Game } from "@/types";
import { Games, BackstageGames, Tracks, VideoTracks, ReviewFlags } from "@/lib/db/repo";
import { GAME_MAX_TRACKS, RESOLVE_POOL_MAX, SFX_DURATION_THRESHOLD_SECONDS } from "@/lib/constants";
import {
  searchGameSoundtrack,
  fetchDiscogsRelease,
  fetchDiscogsMaster,
} from "@/lib/services/discogs";
import { parseSource } from "@/lib/services/tracklist-source";
import { fetchPlaylistItems } from "@/lib/services/youtube";
import { tagTracks } from "@/lib/pipeline/onboarding/tagger";
import { resolveTracksToVideos } from "@/lib/pipeline/onboarding/resolver";
import {
  discoverOSTPlaylist,
  ensureVideoMetadata,
} from "@/lib/pipeline/onboarding/youtube-resolve";
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
  const fresh = await Games.getById(game.id);
  const source = fresh?.tracklist_source ?? game.tracklist_source;
  const parsed = parseSource(source);

  let result: Awaited<ReturnType<typeof searchGameSoundtrack>>;
  let wasPreset = false;

  if (parsed?.key === TracklistSource.Manual) {
    onProgress?.("Tracklist source is manual — skipping Discogs fetch.");
    const existing = await Tracks.getByGame(game.id);
    if (existing.length > 0) {
      await BackstageGames.setPhase(game.id, OnboardingPhase.TracksLoaded);
      return { trackCount: existing.length };
    }
    return null;
  }

  if (parsed?.key === TracklistSource.DiscogsRelease) {
    onProgress?.(`Fetching Discogs release ${parsed.id}…`);
    result = await fetchDiscogsRelease(Number(parsed.id));
    wasPreset = true;
  } else if (parsed?.key === TracklistSource.DiscogsMaster) {
    onProgress?.(`Fetching Discogs master ${parsed.id}…`);
    result = await fetchDiscogsMaster(Number(parsed.id));
    wasPreset = true;
  } else {
    onProgress?.(`Searching Discogs for "${game.title}"…`);
    result = await searchGameSoundtrack(game.title);
  }

  if (!result) {
    const detail = wasPreset
      ? `Configured source "${source}" returned no usable tracks — verify the ID is correct`
      : undefined;
    await ReviewFlags.markAsNeedsReview(game.id, ReviewReason.NoTracklistSource, detail);
    return null;
  }

  const { tracks, releaseId } = result;
  const capped = tracks.slice(0, GAME_MAX_TRACKS);
  if (tracks.length > GAME_MAX_TRACKS) {
    onProgress?.(`Found ${tracks.length} tracks, capping at ${GAME_MAX_TRACKS}…`);
  } else {
    onProgress?.(`Found ${capped.length} tracks…`);
  }

  await Tracks.upsertBatch(
    capped.map((t) => ({
      gameId: game.id,
      name: t.name,
      position: t.position,
    })),
  );

  // Only set tracklist_source if it was discovered (not admin-preset)
  if (!wasPreset) {
    await BackstageGames.update(game.id, { tracklist_source: `${result.sourceType}:${releaseId}` });
  }
  await BackstageGames.setPhase(game.id, OnboardingPhase.TracksLoaded);

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
  onBatchProgress?: (current: number, total: number, trackName: string) => void,
): Promise<{ tagged: number; needsReview: boolean }> {
  const dbTracks = await Tracks.getByGame(game.id);
  const resolvedMap = await VideoTracks.getTrackToVideo(game.id);
  const taggable = dbTracks.filter(
    (t) =>
      resolvedMap.has(t.name) &&
      (t.discovered === null || t.discovered === DiscoveredStatus.Approved),
  );
  onProgress?.(`Tagging ${taggable.length} resolved tracks (${dbTracks.length} total)…`);

  const provider = getTaggingProvider();
  await tagTracks(game.id, game.title, taggable, provider, signal, onBatchProgress);
  await BackstageGames.setPhase(game.id, OnboardingPhase.Tagged);

  const afterTracks = await Tracks.getByGame(game.id);
  const tagged = afterTracks.filter((t) => t.taggedAt !== null).length;
  const updatedGame = await Games.getById(game.id);

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

  const allTracks = await Tracks.getByGame(game.id);

  if (allTracks.length > RESOLVE_POOL_MAX) {
    await ReviewFlags.markAsNeedsReview(
      game.id,
      ReviewReason.TrackCapReached,
      `${allTracks.length - RESOLVE_POOL_MAX} tracks will remain unresolved (${allTracks.length} total, cap is ${RESOLVE_POOL_MAX})`,
    );
  }
  const tracksToResolve = allTracks.slice(0, RESOLVE_POOL_MAX);
  onProgress?.(`Resolving ${tracksToResolve.length} tracks to videos…`);

  const provider = getTaggingProvider();
  const resolved = await resolveTracksToVideos(
    game,
    tracksToResolve,
    playlistItems,
    provider,
    signal,
  );

  // Fetch metadata for ALL resolved video IDs (including auto-discovered inactive tracks)
  onProgress?.("Fetching video metadata…");
  const allVideoIds = [...(await VideoTracks.getTrackToVideo(game.id)).values()];
  await ensureVideoMetadata(allVideoIds, game.id);

  // Auto-deactivate unresolved tracks (no video) and SFX (< threshold)
  const trackToVideo = await VideoTracks.getTrackToVideo(game.id);
  const videoMeta = await VideoTracks.getByGame(game.id);
  const activeTracks = (await Tracks.getByGame(game.id)).filter((t) => t.active);

  const toDeactivate: string[] = [];
  for (const t of activeTracks) {
    const videoId = trackToVideo.get(t.name);
    if (!videoId) {
      toDeactivate.push(t.name);
      continue;
    }
    const meta = videoMeta.get(videoId);
    if (meta?.durationSeconds != null && meta.durationSeconds < SFX_DURATION_THRESHOLD_SECONDS) {
      toDeactivate.push(t.name);
    }
  }

  if (toDeactivate.length > 0) {
    await Tracks.deactivateTracks(game.id, toDeactivate);
    onProgress?.(
      `Deactivated ${toDeactivate.length} track${toDeactivate.length > 1 ? "s" : ""} (no video or SFX)`,
    );
  }

  await BackstageGames.setPhase(game.id, OnboardingPhase.Resolved);

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
    await BackstageGames.setPhase(game.id, OnboardingPhase.Failed);
    throw new Error(`No track data for "${game.title}"`);
  }

  if (signal?.aborted) throw new Error("Cancelled");

  onProgress?.("Phase 2: Resolving videos…", 1, 3);
  const resolveResult = await resolveVideos(game, (msg) => onProgress?.(msg, 1, 3), signal);

  if (signal?.aborted) throw new Error("Cancelled");

  onProgress?.("Phase 3: Tagging tracks…", 2, 3);
  const tagResult = await tagGameTracks(game, (msg) => onProgress?.(msg, 2, 3), signal);

  await BackstageGames.setPublished(game.id, true);
  onProgress?.("Published.", 3, 3);

  return {
    trackCount: loaded.trackCount,
    tagged: tagResult.tagged,
    resolved: resolveResult.resolved,
  };
}
