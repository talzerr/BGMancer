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
    <div className="border-border bg-secondary/50 flex flex-col gap-3 rounded-xl border p-3.5">
      <button
        onClick={onSwitchToGenerate}
        className="hover:text-muted-foreground flex items-center gap-1 self-start text-[11px] text-[var(--text-disabled)] transition-colors"
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
          className="border-border bg-background/70 text-foreground focus:border-primary/40 focus:ring-ring/30 rounded-lg border px-3 py-2 text-sm placeholder-[var(--text-disabled)] transition-colors focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!importUrl.trim() || importing}
          className="border-border bg-secondary/80 text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium transition-colors hover:border-[var(--border-emphasis)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
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
        <p className="text-[11px] text-[var(--text-disabled)]">
          Imports all tracks — creates a new playlist in your history.
        </p>
      )}
    </div>
  );
}
