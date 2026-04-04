import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/services/auth";
import { env } from "@/lib/env";
import { AuthButtons } from "@/components/AuthButtons";
import { FeedClient } from "./feed-client";

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="bg-background relative min-h-screen">
      {/* Header */}
      <header className="bg-background/80 after:bg-border sticky top-0 z-40 backdrop-blur-xl after:absolute after:bottom-0 after:left-0 after:h-px after:w-full">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-xl">
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
              <h1 className="font-display text-foreground text-sm leading-none font-medium tracking-tight">
                BGMancer
              </h1>
              <p className="mt-0.5 text-[10px] leading-none tracking-wide text-[var(--text-tertiary)] uppercase">
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
