"use client";

import { useCallback, useState } from "react";
import type { SyntheticEvent } from "react";
import { GameProgressStatus } from "@/types";
import type { Game, PlaylistTrack } from "@/types";
import { GENERATION_COOLDOWN_MS } from "@/lib/constants";

export interface GenerateConfig {
  target_track_count: number;
  allow_long_tracks: boolean;
  allow_short_tracks: boolean;
  anti_spoiler_enabled: boolean;
}

export type GameProgressEntry = {
  id: string;
  title: string;
  status: GameProgressStatus;
  message: string;
};

export function usePlaylist() {
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState<GameProgressEntry[]>([]);
  const [genGlobalMsg, setGenGlobalMsg] = useState<string>("");
  // Unix ms timestamp after which a new generation is allowed (0 = no cooldown active).
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [rerollingIds, setRerollingIds] = useState<Set<string>>(new Set());

  const fetchTracks = useCallback(async (sessionId?: string) => {
    try {
      const url = sessionId ? `/api/playlist?sessionId=${sessionId}` : "/api/playlist";
      const res = await fetch(url);
      if (res.ok) {
        const data: PlaylistTrack[] = await res.json();
        setTracks(data);
        // Capture the session ID from the first track if not explicitly provided.
        if (!sessionId && data.length > 0) {
          setCurrentSessionId(data[0].playlist_id);
        } else if (sessionId) {
          setCurrentSessionId(sessionId);
        }
      }
    } catch (err) {
      console.error("Failed to fetch playlist:", err);
    } finally {
      setTracksLoading(false);
    }
  }, []);

  const loadForSession = useCallback(
    async (id: string) => {
      setTracksLoading(true);
      await fetchTracks(id);
    },
    [fetchTracks],
  );

  function clearTracks() {
    setTracks([]);
    setCurrentSessionId(null);
    setTracksLoading(false);
  }

  function removeTracksForGame(gameId: string) {
    setTracks((prev) => prev.filter((t) => t.game_id !== gameId));
  }

  function removeTrackLocal(id: string) {
    setTracks((prev) => prev.filter((t) => t.id !== id));
  }

  function restoreTrackLocal(track: PlaylistTrack, position: number) {
    setTracks((prev) => {
      const arr = [...prev];
      arr.splice(position, 0, track);
      return arr;
    });
  }

  async function removeTrack(id: string) {
    try {
      await fetch(`/api/playlist/${id}`, { method: "DELETE" });
      setTracks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error("Failed to remove track:", err);
    }
  }

  async function rerollTrack(id: string) {
    setRerollingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/playlist/${id}/reroll`, { method: "POST" });
      if (res.ok) {
        const { track } = (await res.json()) as { track: PlaylistTrack };
        setTracks((prev) => prev.map((t) => (t.id === id ? track : t)));
      }
    } catch (err) {
      console.error("Failed to reroll track:", err);
    } finally {
      setRerollingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function reorderTracks(orderedIds: string[]) {
    setTracks((prev) => {
      const trackMap = new Map(prev.map((t) => [t.id, t]));
      return orderedIds.map((id) => trackMap.get(id)).filter((t): t is PlaylistTrack => !!t);
    });
    fetch("/api/playlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    }).catch((err) => console.error("Failed to persist track order:", err));
  }

  async function handleGenerate(games: Game[], config?: GenerateConfig) {
    if (games.length === 0) return;

    // Client-side cooldown guard: skip the fetch entirely and let the UI countdown handle it.
    if (Date.now() < cooldownUntil) return;

    setGenError(null);

    // `started` gates the generating UI state: we don't enter it until we've confirmed
    // the server is actually running the generation (first non-error SSE event).
    // This prevents a visual jitter when the server rejects immediately (concurrent
    // generation, server-side cooldown from another client, etc.).
    let started = false;

    try {
      const response = await fetch("/api/playlist/generate", {
        method: "POST",
        headers: config ? { "Content-Type": "application/json" } : undefined,
        body: config ? JSON.stringify(config) : undefined,
      });
      if (!response.body) throw new Error("No response body from server");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "error") {
              // Cooldown error from the server (another client hit the endpoint):
              // parse remaining seconds and update the local cooldown so the
              // countdown UI appears without showing a generic error message.
              const cooldownMatch = (event.message as string)?.match(/wait (\d+)s/);
              if (cooldownMatch) {
                setCooldownUntil(Date.now() + parseInt(cooldownMatch[1], 10) * 1000);
              } else {
                setGenError(event.message ?? "Generation failed");
              }
              return;
            }

            // First non-error event — generation is real; enter generating state now.
            if (!started) {
              started = true;
              setGenProgress(
                games.map((g) => ({
                  id: g.id,
                  title: g.title,
                  status: GameProgressStatus.Waiting,
                  message: "",
                })),
              );
              setGenGlobalMsg("");
              setGenerating(true);
            }

            if (event.type === "progress") {
              if (event.gameId) {
                setGenProgress((prev) =>
                  prev.map((e) =>
                    e.id === event.gameId
                      ? {
                          ...e,
                          status: (event.status as GameProgressStatus) ?? GameProgressStatus.Active,
                          message: event.message,
                        }
                      : e,
                  ),
                );
              } else {
                setGenGlobalMsg(event.message);
              }
            } else if (event.type === "done") {
              setTracks(event.tracks ?? []);
              if (event.sessionId) setCurrentSessionId(event.sessionId);
            }
          } catch {
            // skip malformed SSE line
          }
        }
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Network error");
    } finally {
      if (started) {
        setCooldownUntil(Date.now() + GENERATION_COOLDOWN_MS);
        setGenerating(false);
        setGenGlobalMsg("");
      }
    }
  }

  async function handleFindVideos() {
    setSearching(true);
    try {
      const res = await fetch("/api/playlist/search", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.tracks) setTracks(data.tracks);
    } catch (err) {
      console.error("Failed to search videos:", err);
    } finally {
      setSearching(false);
    }
  }

  async function handleClearPlaylist() {
    try {
      await fetch("/api/playlist", { method: "DELETE" });
      setTracks([]);
    } catch (err) {
      console.error("Failed to clear playlist:", err);
    } finally {
      setConfirmClear(false);
    }
  }

  async function handleImport(e: SyntheticEvent<HTMLFormElement>): Promise<boolean> {
    e.preventDefault();
    if (!importUrl.trim()) return false;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/playlist/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error ?? "Import failed");
        return false;
      }
      // Switch to the newly created session
      const sessionId = data.sessionId;
      if (sessionId) {
        await loadForSession(sessionId);
      } else {
        setTracks(data.tracks ?? []);
      }
      setImportUrl("");
      return true;
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Network error");
      return false;
    } finally {
      setImporting(false);
    }
  }

  return {
    tracks,
    tracksLoading,
    currentSessionId,
    generating,
    searching,
    genError,
    genProgress,
    genGlobalMsg,
    cooldownUntil,
    confirmClear,
    setConfirmClear,
    importUrl,
    setImportUrl,
    importing,
    importError,
    rerollingIds,
    fetchTracks,
    loadForSession,
    clearTracks,
    removeTracksForGame,
    removeTrackLocal,
    restoreTrackLocal,
    removeTrack,
    rerollTrack,
    reorderTracks,
    handleGenerate,
    handleFindVideos,
    handleClearPlaylist,
    handleImport,
  };
}
