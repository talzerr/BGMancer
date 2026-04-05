"use client";

import type { SyntheticEvent } from "react";
import Link from "next/link";
import { MusicNoteOutline, Spinner, YouTubeLogo } from "@/components/Icons";

interface PlaylistEmptyStateProps {
  gamesLength: number;
  importUrl: string;
  onImportUrlChange: (url: string) => void;
  importing: boolean;
  importError: string | null;
  onImport: (e: SyntheticEvent<HTMLFormElement>) => void;
}

export function PlaylistEmptyState({
  gamesLength,
  importUrl,
  onImportUrlChange,
  importing,
  importError,
  onImport,
}: PlaylistEmptyStateProps) {
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

      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        {gamesLength === 0 && (
          <Link
            href="/catalog"
            className="bg-primary text-primary-foreground focus:ring-ring/50 w-full rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[var(--primary-hover)] focus:outline-none"
          >
            Browse catalog
          </Link>
        )}

        <div className="w-full">
          <p className="mb-3 text-xs text-[var(--text-disabled)]">or import a YouTube playlist</p>
          <form onSubmit={onImport} className="flex flex-col gap-2">
            <input
              type="text"
              value={importUrl}
              onChange={(e) => onImportUrlChange(e.target.value)}
              placeholder="Paste a YouTube playlist URL…"
              disabled={importing}
              className="border-border bg-secondary/80 text-foreground focus:border-primary/50 focus:ring-ring/50 w-full rounded-lg border px-3.5 py-2 text-sm placeholder-[var(--text-tertiary)] focus:ring-2 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={importing || !importUrl.trim()}
              className="border-border bg-secondary text-muted-foreground flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? (
                <>
                  <Spinner className="h-3.5 w-3.5" />
                  Importing…
                </>
              ) : (
                <>
                  <YouTubeLogo className="h-3.5 w-3.5 text-red-400" />
                  Import from YouTube
                </>
              )}
            </button>
            {importError && <p className="text-center text-xs text-red-400">{importError}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
