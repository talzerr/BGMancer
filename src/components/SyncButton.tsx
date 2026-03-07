"use client";

import { useState } from "react";

interface SyncResult {
  message: string;
  synced: number;
  playlist_url?: string;
  errors?: Array<{ game_id: string; error: string }>;
}

interface SyncButtonProps {
  isSignedIn: boolean;
  authConfigured: boolean;
  hasFoundGames: boolean;
  onSyncComplete: () => void;
}

export function SyncButton({
  isSignedIn,
  authConfigured,
  hasFoundGames,
  onSyncComplete,
}: SyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!authConfigured) return null;

  const disabled = !isSignedIn || !hasFoundGames || loading;

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
            : !hasFoundGames
            ? "Find OSTs first before syncing"
            : "Sync to YouTube"
        }
        className="flex items-center gap-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-white/[0.06] disabled:opacity-40 px-4 py-2.5 text-sm font-semibold text-zinc-300 focus:outline-none cursor-pointer disabled:cursor-not-allowed"
      >
        {loading ? (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-[#FF0000]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
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
