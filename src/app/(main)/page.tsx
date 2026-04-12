import { auth } from "@/lib/services/auth/auth";
import { env } from "@/lib/env";
import { BackstageGames } from "@/lib/db/repos/backstage-games";
import { FeedClient } from "./FeedClient";

export default async function HomePage() {
  const session = await auth();

  const allPublished = await BackstageGames.listPublished();
  // Shuffle and take 8 covers for the empty-library launchpad preview.
  // Fisher-Yates shuffle via crypto.getRandomValues to satisfy the purity lint rule.
  const coverUrls = allPublished
    .map((g) => g.thumbnail_url)
    .filter((url): url is string => url != null);
  const rand = new Uint32Array(coverUrls.length);
  crypto.getRandomValues(rand);
  const previewCovers = coverUrls
    .map((url, i) => ({ url, r: rand[i] }))
    .sort((a, b) => a.r - b.r)
    .slice(0, 8)
    .map(({ url }) => url);

  return (
    <div className="bg-background relative min-h-screen">
      <FeedClient
        isSignedIn={!!session?.user}
        isDev={env.isDev}
        youtubeSyncEnabled={env.youtubeSyncEnabled}
        turnstileSiteKey={env.turnstileSiteKey}
        user={session?.user ?? null}
        previewCovers={previewCovers}
      />
    </div>
  );
}
