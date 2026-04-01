import { Games, Tracks, VideoTracks, ReviewFlags } from "@/lib/db/repo";
import { notFound } from "next/navigation";
import { idFromGameSlug } from "@/lib/utils";
import { GameDetailClient } from "./game-detail-client";

export default async function GameDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gameId = idFromGameSlug(slug);
  const game = await Games.getById(gameId);
  if (!game) notFound();

  const tracks = await Tracks.getByGame(game.id);
  const reviewFlags = await ReviewFlags.listByGame(game.id);
  const videoMap = Object.fromEntries(await VideoTracks.getTrackToVideo(game.id));

  // Build track-name → full video metadata for TrackEditSheet
  const byVideoId = await VideoTracks.getByGame(game.id);
  const videoDetailMap: Record<
    string,
    { videoId: string; durationSeconds: number | null; viewCount: number | null }
  > = {};
  for (const [videoId, meta] of byVideoId) {
    if (meta.trackName) {
      videoDetailMap[meta.trackName] = {
        videoId,
        durationSeconds: meta.durationSeconds,
        viewCount: meta.viewCount,
      };
    }
  }

  return (
    <GameDetailClient
      game={game}
      tracks={tracks}
      reviewFlags={reviewFlags}
      videoMap={videoMap}
      videoDetailMap={videoDetailMap}
    />
  );
}
