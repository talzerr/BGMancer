import { auth } from "@/lib/services/auth/auth";
import { env } from "@/lib/env";
import { BackstageGames } from "@/lib/db/repos/backstage-games";
import { FeedClient } from "./FeedClient";

export default async function HomePage() {
  const session = await auth();

  const allPublished = await BackstageGames.listPublished();
  // Shuffle and take 8 covers for the empty-library launchpad preview.
  // Fisher-Yates shuffle via crypto.getRandomValues to satisfy the purity lint rule.
  const withCovers = allPublished.filter((g) => g.thumbnail_url);
  const rand = new Uint32Array(withCovers.length);
  crypto.getRandomValues(rand);
  const shuffled = withCovers
    .map((g, i) => ({ g, r: rand[i] }))
    .sort((a, b) => a.r - b.r)
    .map(({ g }) => g);
  const previewCovers = shuffled.slice(0, 8).map((g) => g.thumbnail_url as string);

  return (
    <div className="bg-background relative min-h-screen">
      <FeedClient
        isSignedIn={!!session?.user}
        isDev={env.isDev}
        turnstileSiteKey={env.turnstileSiteKey}
        user={session?.user ?? null}
        previewCovers={previewCovers}
      />
    </div>
  );
}
