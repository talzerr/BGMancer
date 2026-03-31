import { Tracks, VideoTracks } from "@/lib/db/repo";
import { type Game, type TaggedTrack, GameProgressStatus } from "@/types";
import type { GenerateEvent } from "@/lib/pipeline/types";

type Send = (e: GenerateEvent) => void;

/**
 * Builds tagged track candidates for a single game from pre-cached DB data.
 * All games are pre-resolved during onboarding — no YouTube API or LLM calls needed.
 */
export async function fetchGameCandidates(game: Game, send: Send): Promise<TaggedTrack[]> {
  send({
    type: "progress",
    gameId: game.id,
    title: game.title,
    status: GameProgressStatus.Active,
    message: "Loading tracks…",
  });

  const allTracks = await Tracks.getByGame(game.id);
  const activeTracks = allTracks.filter((t) => t.active && t.energy !== null && t.roles.length > 0);

  if (activeTracks.length === 0) {
    send({
      type: "progress",
      gameId: game.id,
      title: game.title,
      status: GameProgressStatus.Done,
      message: "No active tagged tracks",
    });
    return [];
  }

  // Look up pre-resolved video mappings + metadata
  const trackToVideo = await VideoTracks.getTrackToVideo(game.id);
  const videoMeta = await VideoTracks.getByGame(game.id);

  const tracks: TaggedTrack[] = [];
  for (const track of activeTracks) {
    const videoId = trackToVideo.get(track.name);
    if (!videoId) continue;

    const meta = videoMeta.get(videoId);
    tracks.push({
      videoId,
      title: track.name,
      gameId: game.id,
      gameTitle: game.title,
      energy: track.energy as 1 | 2 | 3,
      roles: track.roles,
      moods: track.moods,
      instrumentation: track.instrumentation,
      hasVocals: track.hasVocals ?? false,
      durationSeconds: track.durationSeconds ?? meta?.durationSeconds ?? 0,
      viewCount: meta?.viewCount ?? null,
    });
  }

  send({
    type: "progress",
    gameId: game.id,
    title: game.title,
    status: GameProgressStatus.Done,
    message: `${tracks.length} tracks ready`,
  });

  return tracks;
}
