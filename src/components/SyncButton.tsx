"use client";

import { useState, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { Spinner, YouTubeLogo } from "@/components/Icons";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface SyncResult {
  message: string;
  synced: number;
  playlist_url?: string;
  errors?: Array<{ game_id: string; error: string }>;
}

const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube";
const STATUS_CLEAR_DELAY = 5000;

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
  const clearTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  if (isDev) return null;

  const disabled = !isSignedIn || !hasFoundTracks || loading;

  const tooltipLabel = !isSignedIn
    ? "Sign in with Google to sync"
    : !hasFoundTracks
      ? "Find OSTs first before syncing"
      : "Sync playlist to YouTube";

  async function handleSync() {
    setLoading(true);
    setError(null);
    setResult(null);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);

    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = (await res.json()) as SyncResult & { error?: string };

      if (res.status === 401) {
        signIn(
          "google",
          { callbackUrl: window.location.pathname },
          { scope: `openid email ${YOUTUBE_SCOPE}` },
        );
        return;
      }

      if (!res.ok) throw new Error(data.error ?? "Sync failed");

      setResult(data);
      onSyncComplete();

      if (data.playlist_url) {
        window.open(data.playlist_url, "_blank", "noopener,noreferrer");
      }

      clearTimerRef.current = setTimeout(() => {
        setResult(null);
      }, STATUS_CLEAR_DELAY);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
      clearTimerRef.current = setTimeout(() => {
        setError(null);
      }, STATUS_CLEAR_DELAY);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            onClick={handleSync}
            disabled={disabled}
            className="relative flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/[0.06] bg-zinc-800/80 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700/80 disabled:cursor-not-allowed disabled:opacity-40"
          />
        }
      >
        {loading ? (
          <Spinner className="h-3 w-3" />
        ) : (
          <YouTubeLogo className="h-3 w-3 text-[#FF0000]" />
        )}
        <span className="hidden sm:inline">{loading ? "Syncing…" : "Sync"}</span>
        {error && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-zinc-900" />
        )}
        {result && !error && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-zinc-900" />
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {error ? error : result ? result.message : tooltipLabel}
      </TooltipContent>
    </Tooltip>
  );
}
