import { Games, Tracks, ReviewFlags } from "@/lib/db/repo";
import { notFound } from "next/navigation";
import { idFromGameSlug } from "@/lib/utils";
import { GameDetailClient } from "./game-detail-client";

export default async function GameDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gameId = idFromGameSlug(slug);
  const game = Games.getById(gameId);
  if (!game) notFound();

  const tracks = Tracks.getByGame(game.id);
  const reviewFlags = ReviewFlags.listByGame(game.id);

  return <GameDetailClient game={game} tracks={tracks} reviewFlags={reviewFlags} />;
}
