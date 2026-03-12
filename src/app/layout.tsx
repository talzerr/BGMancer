// BGMancer — Copyright (C) 2026 Tal Koviazin (talzerr)
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU Affero General Public License v3 as published
// by the Free Software Foundation. See the LICENSE file for details.
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { PlayerProvider } from "@/context/player-context";

export const metadata: Metadata = {
  title: "BGMancer — AI Video Game OST Curator",
  description:
    "Add games you've played. BGMancer uses AI to find the best official soundtracks on YouTube and syncs them into your personal playlist.",
  icons: {
    icon: "/icon-512.png",
    apple: "/icon-512.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <PlayerProvider>{children}</PlayerProvider>
        <footer className="border-t border-white/[0.04] py-4 text-center text-[11px] leading-relaxed text-zinc-600">
          <p>
            © 2026 BGMancer™ · Fan-made curation tool · Not affiliated with any developer or
            publisher
          </p>
          <p className="mt-0.5">
            All soundtracks are property of their respective owners · Streamed via YouTube · Not
            hosted here
          </p>
          <p className="mt-1.5 flex items-center justify-center gap-3">
            <Link href="/legal" className="transition-colors hover:text-zinc-400">
              Legal &amp; Fair Use
            </Link>
            <span className="text-zinc-700">·</span>
            <a
              href="https://github.com/talzerr/bgmancer"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-zinc-400"
            >
              GitHub (AGPL-3.0)
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
