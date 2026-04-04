import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/services/auth";
import { env } from "@/lib/env";
import { AuthButtons } from "@/components/AuthButtons";
import { CatalogClient } from "./catalog-client";

export const metadata = { title: "Catalog — BGMancer" };

export default async function CatalogPage() {
  const session = await auth();

  return (
    <div className="relative min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:bg-gradient-to-r after:from-violet-500/40 after:via-violet-500/10 after:to-transparent">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
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

          {/* Nav + Auth */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-violet-400"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"
                />
              </svg>
              Playlist
            </Link>
            <AuthButtons user={session?.user ?? null} isDev={env.isDev} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="mx-auto max-w-7xl">
        <CatalogClient />
      </div>
    </div>
  );
}
