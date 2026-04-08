"use client";

import Link from "next/link";
import { MusicNoteOutline } from "@/components/Icons";

interface PlaylistEmptyStateProps {
  gamesLength: number;
}

export function PlaylistEmptyState({ gamesLength }: PlaylistEmptyStateProps) {
  return (
    <div className="border-border bg-secondary/30 flex flex-col items-center justify-center gap-8 rounded-2xl border px-6 py-14 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="border-border bg-secondary/60 flex h-14 w-14 items-center justify-center rounded-full border">
          <MusicNoteOutline className="h-7 w-7 text-[var(--text-tertiary)]" />
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-foreground text-base font-medium">No playlist yet</h3>
          <p className="max-w-xs text-sm leading-relaxed text-[var(--text-tertiary)]">
            {gamesLength > 0
              ? "Hit Curate to generate a playlist."
              : "Add games to your library, then curate a playlist."}
          </p>
        </div>
      </div>

      {gamesLength === 0 && (
        <Link
          href="/catalog"
          className="bg-primary text-primary-foreground focus:ring-ring/50 w-full max-w-sm rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[var(--primary-hover)] focus:outline-none"
        >
          Browse catalog
        </Link>
      )}
    </div>
  );
}
