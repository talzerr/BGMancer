"use client";

import type { SyntheticEvent } from "react";

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
          <svg className="w-7 h-7 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
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
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                </svg>
                Importing…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
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
