"use client";

import { useCallback, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import type { PlaylistTrack } from "@/types";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

export interface UseSyncArgs {
  currentSessionId: string | null;
  tracks: PlaylistTrack[];
  /** YouTube playlist ID stored on the session row, if the session was
   *  previously synced. Non-null → hook starts in "synced" state. */
  initialYoutubePlaylistId: string | null;
}

export interface UseSyncResult {
  status: SyncStatus;
  error: string | null;
  playlistUrl: string | null;
  /** Returns true if the sync fully succeeded (status transitioned to
   *  "synced"). Lets the dialog close itself without reading stale state. */
  sync: () => Promise<boolean>;
  resetSync: () => void;
}

/** Build the canonical YouTube playlist URL from a playlist ID. */
function playlistUrlFor(id: string): string {
  return `https://www.youtube.com/playlist?list=${id}`;
}

function fingerprintTracks(tracks: PlaylistTrack[]): string {
  return tracks.map((t) => t.id).join("|");
}

const YOUTUBE_SIGNIN_SCOPE = "openid email https://www.googleapis.com/auth/youtube";

interface InternalState {
  status: SyncStatus;
  error: string | null;
  playlistUrl: string | null;
  baselineSessionId: string | null;
  baselineFingerprint: string;
}

export function useSync({
  currentSessionId,
  tracks,
  initialYoutubePlaylistId,
}: UseSyncArgs): UseSyncResult {
  const trackFingerprint = useMemo(() => fingerprintTracks(tracks), [tracks]);

  const [state, setState] = useState<InternalState>(() => ({
    status: initialYoutubePlaylistId ? "synced" : "idle",
    error: null,
    playlistUrl: initialYoutubePlaylistId ? playlistUrlFor(initialYoutubePlaylistId) : null,
    baselineSessionId: currentSessionId,
    baselineFingerprint: trackFingerprint,
  }));

  if (
    state.baselineSessionId !== currentSessionId ||
    state.baselineFingerprint !== trackFingerprint
  ) {
    const sessionChanged = state.baselineSessionId !== currentSessionId;
    const restoreSynced = sessionChanged && !!initialYoutubePlaylistId;
    setState({
      status: restoreSynced ? "synced" : "idle",
      error: null,
      playlistUrl: restoreSynced ? playlistUrlFor(initialYoutubePlaylistId) : null,
      baselineSessionId: currentSessionId,
      baselineFingerprint: trackFingerprint,
    });
  }

  const resetSync = useCallback(() => {
    setState((prev) => ({ ...prev, status: "idle", error: null }));
  }, []);

  const sync = useCallback(async (): Promise<boolean> => {
    if (!currentSessionId) return false;
    setState((prev) => ({ ...prev, status: "syncing", error: null }));

    let res: Response;
    try {
      res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSessionId }),
      });
    } catch {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: "Could not reach server. Try again.",
      }));
      return false;
    }

    if (res.status === 401) {
      // Incremental auth: ask the user for the YouTube scope on top of their
      // existing session. Google bounces them back here with the scope
      // appended; the dialog-driven retry then proceeds normally.
      await signIn(
        "google",
        { callbackUrl: window.location.pathname },
        { scope: YOUTUBE_SIGNIN_SCOPE },
      );
      return false;
    }

    const data = (await res.json().catch(() => null)) as {
      playlistId?: string;
      playlistUrl?: string;
      error?: string;
    } | null;

    if (!res.ok || !data?.playlistId || !data.playlistUrl) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: data?.error ?? "Couldn't create playlist. Try again.",
      }));
      return false;
    }

    setState((prev) => ({
      ...prev,
      status: "synced",
      error: null,
      playlistUrl: data.playlistUrl,
    }));
    return true;
  }, [currentSessionId]);

  return {
    status: state.status,
    error: state.error,
    playlistUrl: state.playlistUrl,
    sync,
    resetSync,
  };
}
