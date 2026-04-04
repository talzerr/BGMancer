"use client";

import type { SyntheticEvent } from "react";
import { Spinner, PlayIcon } from "@/components/Icons";

interface ImportSectionProps {
  importUrl: string;
  onImportUrlChange: (url: string) => void;
  importing: boolean;
  onImport: (e: SyntheticEvent<HTMLFormElement>) => void;
  onSwitchToGenerate: () => void;
}

export function ImportSection({
  importUrl,
  onImportUrlChange,
  importing,
  onImport,
  onSwitchToGenerate,
}: ImportSectionProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/[0.05] bg-zinc-900/50 p-3.5">
      <button
        onClick={onSwitchToGenerate}
        className="flex items-center gap-1 self-start text-[11px] text-zinc-600 transition-colors hover:text-zinc-400"
      >
        ← Back to Curate
      </button>

      <form onSubmit={onImport} className="flex flex-col gap-2">
        <input
          id="playlist-url"
          type="text"
          placeholder="YouTube playlist URL or ID…"
          value={importUrl}
          onChange={(e) => onImportUrlChange(e.target.value)}
          disabled={importing}
          className="rounded-lg border border-white/[0.07] bg-zinc-950/70 px-3 py-2 text-sm text-white placeholder-zinc-600 transition-colors focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!importUrl.trim() || importing}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/[0.07] bg-zinc-800/80 px-4 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-red-500/30 hover:bg-red-950/50 hover:text-red-400 active:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {importing ? (
            <>
              <Spinner className="h-3 w-3" />
              Importing…
            </>
          ) : (
            <>
              <PlayIcon className="h-3 w-3" />
              Import from YouTube
            </>
          )}
        </button>
      </form>
      {!importing && (
        <p className="text-[11px] text-zinc-600">
          Imports all tracks — creates a new playlist in your history.
        </p>
      )}
    </div>
  );
}
