import type { Metadata } from "next";
import { auth } from "@/lib/services/auth/auth";
import { PlayerProvider } from "@/context/player-context";
import { Games, Playlist } from "@/lib/db/repo";
import type { Game, PlaylistTrack } from "@/types";

export const metadata: Metadata = {
  title: "BGMancer — Video game OST curator",
  description:
    "Add games you've played. BGMancer uses AI to find the best official soundtracks on YouTube and syncs them into your personal playlist.",
  icons: {
    icon: "/icon-512.png",
    apple: "/icon-512.png",
  },
};

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  let initialGames: Game[] = [];
  let initialTracks: PlaylistTrack[] = [];
  let initialSessionId: string | null = null;
  if (userId) {
    const [games, tracks] = await Promise.all([
      Games.listAll(userId),
      Playlist.listAllWithGameTitle(userId),
    ]);
    initialGames = games;
    initialTracks = tracks;
    initialSessionId = tracks[0]?.playlist_id ?? null;
  }

  return (
    <PlayerProvider
      isSignedIn={!!session?.user}
      initialGames={initialGames}
      initialTracks={initialTracks}
      initialSessionId={initialSessionId}
    >
      {children}
    </PlayerProvider>
  );
}
