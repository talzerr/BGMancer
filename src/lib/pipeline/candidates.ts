import { Tracks, VideoTracks } from "@/lib/db/repo";
import { type Game, type TaggedTrack, GameProgressStatus } from "@/types";
import type { GenerateEvent } from "@/lib/pipeline/types";

type Send = (e: GenerateEvent) => void;

/**
 * Returns the curated TaggedTrack pool for a game from pre-cached DB data.
 * No YouTube API or LLM calls — all data resolved during onboarding.
 */
export async function getTaggedPool(gameId: string, gameTitle: string): Promise<TaggedTrack[]> {
  const allTracks = await Tracks.getByGame(gameId);
  const activeTracks = allTracks.filter((t) => t.active && t.energy !== null && t.roles.length > 0);
  if (activeTracks.length === 0) return [];

  const trackToVideo = await VideoTracks.getTrackToVideo(gameId);
  const videoMeta = await VideoTracks.getByGame(gameId);

  const tracks: TaggedTrack[] = [];
  for (const track of activeTracks) {
    const videoId = trackToVideo.get(track.name);
    if (!videoId) continue;

    const meta = videoMeta.get(videoId);
    tracks.push({
      videoId,
      title: track.name,
      gameId,
      gameTitle,
      energy: track.energy as 1 | 2 | 3,
      roles: track.roles,
      moods: track.moods,
      instrumentation: track.instrumentation,
      hasVocals: track.hasVocals ?? false,
      durationSeconds: meta?.durationSeconds ?? 0,
      viewCount: meta?.viewCount ?? null,
    });
  }

  return tracks;
}

/**
 * Builds tagged track candidates for a single game, with SSE progress events.
 * Wraps `getTaggedPool` with progress reporting for the generation pipeline.
 */
export async function fetchGameCandidates(game: Game, send: Send): Promise<TaggedTrack[]> {
  send({
    type: "progress",
    gameId: game.id,
    title: game.title,
    status: GameProgressStatus.Active,
    message: "Loading tracks…",
  });

  const tracks = await getTaggedPool(game.id, game.title);

  send({
    type: "progress",
    gameId: game.id,
    title: game.title,
    status: GameProgressStatus.Done,
    message: tracks.length > 0 ? `${tracks.length} tracks ready` : "No active tagged tracks",
  });

  return tracks;
}
