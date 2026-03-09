"use client";

import { useCallback, useState } from "react";
import type { SyntheticEvent } from "react";
import type { Game, PlaylistTrack } from "@/types";

export type GameProgressEntry = {
  id: string;
  title: string;
  status: "waiting" | "active" | "done" | "error";
  message: string;
};

export function usePlaylist() {
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState<GameProgressEntry[]>([]);
  const [genGlobalMsg, setGenGlobalMsg] = useState<string>("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [rerollingIds, setRerollingIds] = useState<Set<string>>(new Set());

  const fetchTracks = useCallback(async () => {
    try {
      const res = await fetch("/api/playlist");
      if (res.ok) setTracks(await res.json());
    } catch (err) {
      console.error("Failed to fetch playlist:", err);
    } finally {
      setTracksLoading(false);
    }
  }, []);

  function removeTracksForGame(gameId: string) {
    setTracks((prev) => prev.filter((t) => t.game_id !== gameId));
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

  async function handleGenerate(games: Game[]) {
    if (games.length === 0) return;
    setGenProgress(
      games.map((g) => ({ id: g.id, title: g.title, status: "waiting", message: "" })),
    );
    setGenGlobalMsg("");
    setGenerating(true);
    setGenError(null);

    try {
      const response = await fetch("/api/playlist/generate", { method: "POST" });
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
            if (event.type === "progress") {
              if (event.gameId) {
                setGenProgress((prev) =>
                  prev.map((e) =>
                    e.id === event.gameId
                      ? { ...e, status: event.status ?? "active", message: event.message }
                      : e,
                  ),
                );
              } else {
                setGenGlobalMsg(event.message);
              }
            } else if (event.type === "done") {
              setTracks(event.tracks ?? []);
            } else if (event.type === "error") {
              setGenError(event.message ?? "Generation failed");
            }
          } catch {
            // skip malformed SSE line
          }
        }
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Network error");
    } finally {
      setGenerating(false);
      setGenGlobalMsg("");
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
      setTracks(data.tracks ?? []);
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
    generating,
    searching,
    genError,
    genProgress,
    genGlobalMsg,
    confirmClear,
    setConfirmClear,
    importUrl,
    setImportUrl,
    importing,
    importError,
    rerollingIds,
    fetchTracks,
    removeTracksForGame,
    removeTrack,
    rerollTrack,
    reorderTracks,
    handleGenerate,
    handleFindVideos,
    handleClearPlaylist,
    handleImport,
  };
}
