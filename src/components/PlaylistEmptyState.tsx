"use client";

import type { SyntheticEvent } from "react";
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
    <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-white/[0.04] bg-zinc-900/30 px-6 py-14 text-center">
      <div className="flex flex-col items-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-zinc-800/60">
          <MusicNoteOutline className="h-7 w-7 text-zinc-500" />
        </div>
        <h3 className="mb-1.5 text-sm font-semibold text-zinc-400">No playlist yet</h3>
        <p className="max-w-xs text-sm leading-relaxed text-zinc-400">
          {gamesLength === 0
            ? "Add some games to your library, then generate a playlist."
            : "Click Generate Playlist to create your AI-curated soundtrack."}
        </p>
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-px flex-1 bg-white/[0.06]" />
          <span className="text-[11px] tracking-widest text-zinc-600 uppercase">
            or import directly
          </span>
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>
        <form onSubmit={onImport} className="flex flex-col gap-2">
          <input
            type="text"
            value={importUrl}
            onChange={(e) => onImportUrlChange(e.target.value)}
            placeholder="Paste a YouTube playlist URL…"
            disabled={importing}
            className="w-full rounded-lg border border-white/[0.07] bg-zinc-800/80 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/50 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={importing || !importUrl.trim()}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/[0.07] bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
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
  );
}
