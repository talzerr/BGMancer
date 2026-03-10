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

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) setSessions(await res.json());
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await fetchSessions();
    })();
  }, [fetchSessions]);

  async function handleRenameSession(id: string, name: string) {
    try {
      await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    } catch (err) {
      console.error("Failed to rename session:", err);
    }
  }

  async function handleDeleteSession(id: string) {
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      const { nextSessionId } = await res.json();
      if (player.playingTrackId) {
        const isFromDeletedSession = playlist.tracks.some((t) => t.id === player.playingTrackId);
        if (isFromDeletedSession) player.reset();
      }
      if (nextSessionId) {
        await playlist.loadForSession(nextSessionId);
      } else {
        playlist.clearTracks();
      }
      await fetchSessions();
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  }

  return { sessions, fetchSessions, handleRenameSession, handleDeleteSession };
}
