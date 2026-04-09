import { auth } from "@/lib/services/auth/auth";
import { env } from "@/lib/env";
import { FeedClient } from "./FeedClient";

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="bg-background relative min-h-screen">
      <FeedClient
        isSignedIn={!!session?.user}
        isDev={env.isDev}
        turnstileSiteKey={env.turnstileSiteKey}
        user={session?.user ?? null}
      />
    </div>
  );
}
