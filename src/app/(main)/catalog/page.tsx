import Link from "next/link";
import { auth } from "@/lib/services/auth/auth";
import { env } from "@/lib/env";
import { Header } from "@/components/layout/Header";
import { CatalogClient } from "./CatalogClient";

export const metadata = { title: "Catalog — BGMancer" };

export default async function CatalogPage() {
  const session = await auth();

  return (
    <div className="bg-background relative min-h-screen">
      <Header
        user={session?.user ?? null}
        isDev={env.isDev}
        nav={
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
        }
      />

      {/* Main content */}
      <div className="mx-auto max-w-7xl">
        <CatalogClient />
      </div>
    </div>
  );
}
