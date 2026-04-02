"use client";

import { useState } from "react";
import { Spinner, YouTubeLogo } from "@/components/Icons";

interface SyncResult {
  message: string;
  synced: number;
  playlist_url?: string;
  errors?: Array<{ game_id: string; error: string }>;
}

interface SyncButtonProps {
  isSignedIn: boolean;
  isDev: boolean;
  hasFoundTracks: boolean;
  onSyncComplete: () => void;
}

export function SyncButton({ isSignedIn, isDev, hasFoundTracks, onSyncComplete }: SyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isDev) return null;

  const disabled = !isSignedIn || !hasFoundTracks || loading;

  async function handleSync() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = (await res.json()) as SyncResult & { error?: string };

      if (!res.ok) throw new Error(data.error ?? "Sync failed");

      setResult(data);
      onSyncComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={handleSync}
        disabled={disabled}
        title={
          !isSignedIn
            ? "Sign in with Google to sync"
            : !hasFoundTracks
              ? "Find OSTs first before syncing"
              : "Sync to YouTube"
        }
        className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.06] bg-zinc-800/80 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-700/80 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? (
          <Spinner className="h-3.5 w-3.5" />
        ) : (
          <YouTubeLogo className="h-3.5 w-3.5 text-[#FF0000]" />
        )}
        {loading ? "Syncing…" : "Sync to YouTube"}
      </button>

      {result && (
        <div>
          <p className="text-xs text-emerald-400">{result.message}</p>
          {result.playlist_url && (
            <a
              href={result.playlist_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-violet-400 underline underline-offset-2 hover:text-violet-300"
            >
              Open BGMancer Journey →
            </a>
          )}
          {result.errors && result.errors.length > 0 && (
            <p className="mt-0.5 text-xs text-amber-400">
              {result.errors.length} item(s) failed to add.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
