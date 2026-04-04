"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlayerContext } from "@/context/player-context";
import type { PlaylistSessionWithCount } from "@/types";

/**
 * Manages the session list and all session-level mutations (rename, delete).
 * Coordinates between the sessions API, the playlist state, and the player state.
 */
export function useSessionManager() {
  const { playlist, player } = usePlayerContext();
  const [sessions, setSessions] = useState<PlaylistSessionWithCount[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/sessions");
      if (res.ok) setSessions(await res.json());
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
      setError("Failed to load sessions");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await fetchSessions();
    })();
  }, [fetchSessions]);

  async function handleRenameSession(id: string, name: string) {
    try {
      setError(null);
      await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    } catch (err) {
      console.error("Failed to rename session:", err);
      setError("Failed to rename session");
    }
  }

  async function handleDeleteSession(id: string) {
    try {
      setError(null);
      const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      const { nextSessionId } = (await res.json()) as { nextSessionId?: string };

      // Stop playback if we're deleting the session that's currently playing
      const isDeletingPlayingSession = id === player.playingSessionId;
      if (isDeletingPlayingSession) {
        player.reset();
      }

      const isDeletingViewedSession = id === playlist.currentSessionId;
      if (isDeletingViewedSession) {
        if (nextSessionId) {
          await playlist.loadForSession(nextSessionId);
        } else {
          playlist.clearTracks();
        }
      }
      await fetchSessions();
    } catch (err) {
      console.error("Failed to delete session:", err);
      setError("Failed to delete session");
    }
  }

  return { sessions, error, fetchSessions, handleRenameSession, handleDeleteSession };
}
