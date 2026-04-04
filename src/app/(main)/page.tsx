import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/services/auth";
import { env } from "@/lib/env";
import { AuthButtons } from "@/components/AuthButtons";
import { FeedClient } from "./feed-client";

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="relative min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:bg-gradient-to-r after:from-violet-500/40 after:via-violet-500/10 after:to-transparent">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-xl shadow-lg shadow-violet-900/50">
              <Image
                src="/icon-512.png"
                alt="BGMancer"
                width={32}
                height={32}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div>
              <h1 className="font-display text-sm leading-none font-bold tracking-tight text-white">
                BGMancer
              </h1>
              <p className="mt-0.5 text-[10px] leading-none tracking-wide text-zinc-500 uppercase">
                AI OST Curator
              </p>
            </div>
          </Link>

          {/* Auth */}
          <AuthButtons user={session?.user ?? null} isDev={env.isDev} />
        </div>
      </header>

      {/* Main content */}
      <main className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <FeedClient
          isSignedIn={!!session?.user}
          isDev={env.isDev}
          turnstileSiteKey={env.turnstileSiteKey}
        />
      </main>
    </div>
  );
}
