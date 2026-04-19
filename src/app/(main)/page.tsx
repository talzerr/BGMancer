import { auth } from "@/lib/services/auth/auth";
import { env } from "@/lib/env";
import { Games } from "@/lib/db/repos/games";
import { FeedClient } from "./FeedClient";

export default async function HomePage() {
  const session = await auth();

  const coverUrls = await Games.listPublishedCoverUrls(24);
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
        turnstileSiteKey={env.turnstileSiteKey}
        user={session?.user ?? null}
        previewCovers={previewCovers}
      />
    </div>
  );
}
