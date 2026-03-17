import type { Metadata } from "next";
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

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlayerProvider>
      {children}
      <footer className="border-t border-white/[0.04] py-4 text-center text-[11px] leading-relaxed text-zinc-600">
        <p>
          © 2026 BGMancer™ · Fan-made curation tool · Not affiliated with any developer or publisher
        </p>
        <p className="mt-0.5">
          All soundtracks are property of their respective owners · Streamed via YouTube · Not
          hosted here
        </p>
        <p className="mt-1.5">
          <a
            href="https://github.com/talzerr/bgmancer"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-zinc-400"
          >
            Source Code
          </a>
        </p>
      </footer>
    </PlayerProvider>
  );
}
