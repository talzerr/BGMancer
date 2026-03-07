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

  // OAuth not yet configured — show a passive reminder instead of a button
  if (!authConfigured) {
    return (
      <p className="text-xs text-zinc-500 max-w-xs text-right">
        Add <code className="text-zinc-400">GOOGLE_CLIENT_ID</code> &amp;{" "}
        <code className="text-zinc-400">GOOGLE_CLIENT_SECRET</code> to .env.local
        to enable YouTube playlist sync.
      </p>
    );
  }

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
    <div className="flex flex-col items-end gap-2">
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
        className="flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-400 px-4 py-2.5 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-zinc-900 cursor-pointer disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.54V6.78a4.85 4.85 0 01-1.02-.09z" />
        </svg>
        {loading ? "Syncing…" : "Sync to YouTube"}
      </button>

      {result && (
        <div className="text-right">
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
