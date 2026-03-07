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
    <div className="flex flex-col items-center justify-center py-14 text-center rounded-2xl bg-zinc-900/30 border border-white/[0.04] px-6 gap-6">
      <div className="flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-zinc-800/60 border border-white/[0.06] flex items-center justify-center mb-4">
          <MusicNoteOutline className="w-7 h-7 text-zinc-500" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-400 mb-1.5">No playlist yet</h3>
        <p className="text-sm text-zinc-400 max-w-xs leading-relaxed">
          {gamesLength === 0
            ? "Add some games to your library, then generate a playlist."
            : "Click Generate Playlist to create your AI-curated soundtrack."}
        </p>
      </div>

      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[11px] text-zinc-600 uppercase tracking-widest">or import directly</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>
        <form onSubmit={onImport} className="flex flex-col gap-2">
          <input
            type="text"
            value={importUrl}
            onChange={(e) => onImportUrlChange(e.target.value)}
            placeholder="Paste a YouTube playlist URL…"
            disabled={importing}
            className="w-full rounded-lg bg-zinc-800/80 border border-white/[0.07] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={importing || !importUrl.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/[0.07] disabled:opacity-50 px-4 py-2 text-sm font-medium text-zinc-300 cursor-pointer disabled:cursor-not-allowed"
          >
            {importing ? (
              <>
                <Spinner className="w-3.5 h-3.5" />
                Importing…
              </>
            ) : (
              <>
                <YouTubeLogo className="w-3.5 h-3.5 text-red-400" />
                Import from YouTube
              </>
            )}
          </button>
          {importError && (
            <p className="text-xs text-red-400 text-center">{importError}</p>
          )}
        </form>
      </div>
    </div>
  );
}
