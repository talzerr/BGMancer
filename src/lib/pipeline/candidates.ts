import { Games, Tracks } from "@/lib/db/repo";
import { compilationQueries, makePendingTrack } from "@/lib/pipeline/assembly";
import { fetchPlaylistItems } from "@/lib/services/youtube";
import type { OSTTrack } from "@/lib/services/youtube";
import { discoverOSTPlaylist, ensureVideoMetadata } from "@/lib/pipeline/youtube-resolve";
import {
  type Game,
  type TaggedTrack,
  GameProgressStatus,
  OnboardingPhase,
  TrackRole,
} from "@/types";
import type { GenerateEvent, CandidateResult } from "@/lib/pipeline/types";
import { resolveTracksToVideos } from "@/lib/pipeline/resolver";
import { getTaggingProvider } from "@/lib/llm";

type Send = (e: GenerateEvent) => void;

// ─── Private helpers ─────────────────────────────────────────────────────────

async function resolveCurated(
  game: Game,
  playlistTracks: OSTTrack[],
  send: Send,
): Promise<CandidateResult> {
  const allTracks = Tracks.getByGame(game.id);

  if (!allTracks.some((t) => t.active)) {
    send({
      type: "progress",
      gameId: game.id,
      title: game.title,
      status: GameProgressStatus.Done,
      message: "No active tracks",
    });
    return { kind: "tagged", game, tracks: [] };
  }

  send({
    type: "progress",
    gameId: game.id,
    title: game.title,
    status: GameProgressStatus.Active,
    message: "Resolving tracks to videos…",
  });

  const provider = getTaggingProvider();
  const resolved = await resolveTracksToVideos(game, allTracks, playlistTracks, provider);
  const filtered = resolved.filter(
    (r): r is typeof r & { energy: NonNullable<typeof r.energy> } =>
      r.energy !== null && r.roles.length > 0,
  );

  // Prefer Discogs durations (more accurate); fetch YouTube metadata for all tracks to populate
  // view counts (and duration for tracks Discogs didn't cover).
  const discogsDurations = new Map<string, number>(
    filtered.flatMap((r) => (r.durationSeconds != null ? [[r.videoId, r.durationSeconds]] : [])),
  );
  const videoMeta = await ensureVideoMetadata(
    filtered.map((r) => r.videoId),
    game.id,
  );

  const tracks: TaggedTrack[] = filtered.map((r) => {
    const meta = videoMeta.get(r.videoId);
    return {
      videoId: r.videoId,
      title: r.videoTitle,
      channelTitle: r.channelTitle,
      thumbnail: r.thumbnail,
      gameId: game.id,
      gameTitle: game.title,
      cleanName: r.trackName,
      energy: r.energy,
      roles: r.roles,
      isJunk: false,
      moods: r.moods,
      instrumentation: r.instrumentation,
      hasVocals: r.hasVocals ?? false,
      durationSeconds: discogsDurations.get(r.videoId) ?? meta?.durationSeconds ?? 0,
      viewCount: meta?.viewCount ?? null,
    };
  });

  send({
    type: "progress",
    gameId: game.id,
    title: game.title,
    status: GameProgressStatus.Done,
    message: `${tracks.length} tracks resolved`,
  });

  return { kind: "tagged", game, tracks };
}

async function resolveLegacy(
  game: Game,
  playlistTracks: OSTTrack[],
  send: Send,
): Promise<CandidateResult> {
  send({
    type: "progress",
    gameId: game.id,
    title: game.title,
    status: GameProgressStatus.Active,
    message: "Legacy path — limited quality",
  });

  const videoMeta = await ensureVideoMetadata(
    playlistTracks.map((t) => t.videoId),
    game.id,
  );

  const tracks: TaggedTrack[] = playlistTracks.map((t) => {
    const meta = videoMeta.get(t.videoId);
    return {
      videoId: t.videoId,
      title: t.title,
      channelTitle: t.channelTitle,
      thumbnail: t.thumbnail,
      gameId: game.id,
      gameTitle: game.title,
      cleanName: t.title,
      energy: 2 as const,
      roles: [TrackRole.Ambient],
      isJunk: false,
      moods: [],
      instrumentation: [],
      hasVocals: false,
      durationSeconds: meta?.durationSeconds ?? 0,
      viewCount: meta?.viewCount ?? null,
    };
  });

  send({
    type: "progress",
    gameId: game.id,
    title: game.title,
    status: GameProgressStatus.Done,
    message: `${tracks.length} tracks queued (limited quality)`,
  });

  return { kind: "tagged", game, tracks };
}

// ─── Phase 1 + 1.5 orchestrator ──────────────────────────────────────────────

/**
 * Phases 1 & 1.5 for a single game:
 *   Phase 1   — Discovers the YouTube OST playlist ID (searches if not cached).
 *   Phase 1.5 — Resolves tracks: curated games align DB tags to video IDs;
 *               legacy games receive static stubs. Durations are fetched and
 *               stored for all resolved tracks.
 */
export async function fetchGameCandidates(game: Game, send: Send): Promise<CandidateResult> {
  const playlistId = await discoverOSTPlaylist(game, (msg) =>
    send({
      type: "progress",
      gameId: game.id,
      title: game.title,
      status: GameProgressStatus.Active,
      message: msg,
    }),
  );

  if (!playlistId) {
    send({
      type: "progress",
      gameId: game.id,
      title: game.title,
      status: GameProgressStatus.Done,
      message: "No playlist found — queued for search",
    });
    return {
      kind: "fallback",
      game,
      pendingTracks: [
        makePendingTrack(game.id, game.title, {
          search_queries: compilationQueries(game.title),
          error_message: "No OST playlist found on YouTube — will search individually.",
        }),
      ],
    };
  }

  send({
    type: "progress",
    gameId: game.id,
    title: game.title,
    status: GameProgressStatus.Active,
    message: "Fetching track list…",
  });
  const playlistTracks = await fetchPlaylistItems(playlistId);

  if (playlistTracks.length === 0) {
    send({
      type: "progress",
      gameId: game.id,
      title: game.title,
      status: GameProgressStatus.Done,
      message: "No tracks found",
    });
    return { kind: "tagged", game, tracks: [] };
  }

  if (Tracks.hasData(game.id)) {
    if (Tracks.isTagged(game.id)) {
      return resolveCurated(game, playlistTracks, send);
    }
    // Tracks exist but tagging never completed — reset to Draft so admin can retry.
    Games.setPhase(game.id, OnboardingPhase.Draft);
  }
  return resolveLegacy(game, playlistTracks, send);
}
