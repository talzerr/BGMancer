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
  authConfigured: boolean;
  hasFoundTracks: boolean;
  onSyncComplete: () => void;
}

export function SyncButton({
  isSignedIn,
  authConfigured,
  hasFoundTracks,
  onSyncComplete,
}: SyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!authConfigured) return null;

  const disabled = !isSignedIn || !hasFoundTracks || loading;

  async function handleSync() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();

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
        className="flex items-center gap-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-white/[0.06] disabled:opacity-40 px-4 py-2.5 text-sm font-semibold text-zinc-300 focus:outline-none cursor-pointer disabled:cursor-not-allowed"
      >
        {loading ? (
          <Spinner className="w-3.5 h-3.5" />
        ) : (
          <YouTubeLogo className="w-3.5 h-3.5 text-[#FF0000]" />
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
              className="text-xs text-violet-400 hover:text-violet-300 underline underline-offset-2"
            >
              Open BGMancer Journey →
            </a>
          )}
          {result.errors && result.errors.length > 0 && (
            <p className="text-xs text-amber-400 mt-0.5">
              {result.errors.length} item(s) failed to add.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
