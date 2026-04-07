import { auth } from "@/lib/services/auth/auth";
import { env } from "@/lib/env";
import { Header } from "@/components/layout/Header";
import { FeedClient } from "./FeedClient";

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="bg-background relative min-h-screen">
      <Header user={session?.user ?? null} isDev={env.isDev} />

      {/* Main content */}
      <main className="relative mx-auto max-w-6xl px-4 pt-12 pb-6 sm:px-6">
        <FeedClient
          isSignedIn={!!session?.user}
          isDev={env.isDev}
          turnstileSiteKey={env.turnstileSiteKey}
        />
      </main>
    </div>
  );
}
