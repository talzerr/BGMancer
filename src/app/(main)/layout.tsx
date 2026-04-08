import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/services/auth/auth";
import { PlayerProvider } from "@/context/player-context";

export const metadata: Metadata = {
  title: "BGMancer — Video game OST curator",
  description:
    "Add games you've played. BGMancer uses AI to find the best official soundtracks on YouTube and syncs them into your personal playlist.",
  icons: {
    icon: "/icon-512.png",
    apple: "/icon-512.png",
  },
};

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <PlayerProvider isSignedIn={!!session?.user}>
      {children}
      <footer className="border-border border-t py-4 text-center text-[11px] leading-relaxed text-[var(--text-disabled)]">
        <p>
          © 2026 BGMancer™ · Fan-made curation tool · Not affiliated with any developer or publisher
        </p>
        <p className="mt-0.5">
          All soundtracks are property of their respective owners · Streamed via{" "}
          <a
            href="https://www.youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground transition-colors"
          >
            YouTube
          </a>{" "}
          · Not hosted here
        </p>
        <p className="mt-1.5">
          <a
            href="https://github.com/talzerr/bgmancer"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground transition-colors"
          >
            Source Code
          </a>
          <span className="mx-1.5">·</span>
          <Link href="/legal" className="hover:text-muted-foreground transition-colors">
            Legal
          </Link>
          <span className="mx-1.5">·</span>
          <span>Discord: talzxc</span>
        </p>
      </footer>
    </PlayerProvider>
  );
}
