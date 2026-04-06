import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/services/auth/auth";
import { env } from "@/lib/env";
import { AuthButtons } from "@/components/AuthButtons";
import { CatalogClient } from "./CatalogClient";

export const metadata = { title: "Catalog — BGMancer" };

export default async function CatalogPage() {
  const session = await auth();

  return (
    <div className="bg-background relative min-h-screen">
      {/* Header */}
      <header className="bg-background/80 after:bg-border sticky top-0 z-40 backdrop-blur-xl after:absolute after:bottom-0 after:left-0 after:h-px after:w-full">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
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

          {/* Nav + Auth */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-muted-foreground hover:text-primary flex items-center gap-1.5 text-sm transition-colors"
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
