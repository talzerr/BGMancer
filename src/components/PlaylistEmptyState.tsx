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
    <div className="flex flex-col items-center justify-center gap-8 rounded-2xl border border-white/[0.04] bg-zinc-900/30 px-6 py-14 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.06] bg-zinc-800/60">
          <MusicNoteOutline className="h-7 w-7 text-zinc-500" />
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-base font-semibold text-zinc-200">No playlist yet</h3>
          <p className="max-w-xs text-sm leading-relaxed text-zinc-500">
            {gamesLength > 0
              ? "You have games in your library. Hit Curate to generate a playlist shaped to your session."
              : "Build a library of game soundtracks and the Director will compose a playlist shaped to your session."}
          </p>
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        {gamesLength === 0 && (
          <Link
            href="/catalog"
            className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 focus:ring-2 focus:ring-violet-500/50 focus:outline-none"
          >
            Build Your Library
          </Link>
        )}

        <div className="w-full">
          <p className="mb-3 text-xs text-zinc-600">or import a YouTube playlist</p>
          <form onSubmit={onImport} className="flex flex-col gap-2">
            <input
              type="text"
              value={importUrl}
              onChange={(e) => onImportUrlChange(e.target.value)}
              placeholder="Paste a YouTube playlist URL…"
              disabled={importing}
              className="w-full rounded-lg border border-white/[0.07] bg-zinc-800/80 px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/50 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={importing || !importUrl.trim()}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/[0.07] bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-400 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
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
