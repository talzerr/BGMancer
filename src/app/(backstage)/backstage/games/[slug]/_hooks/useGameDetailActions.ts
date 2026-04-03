"use client";

import { useState } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { Game, Track } from "@/types";
import type { PatchUpdates } from "@/components/backstage/TrackEditSheet";
import type { ParsedTrack } from "@/lib/services/track-parser";

export function useGameDetailActions(game: Game, router: AppRouterInstance) {
  const [mutError, setMutError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [sseRunning, setSseRunning] = useState(false);
  const [nuking, setNuking] = useState(false);
  const [reingestRunning, setReingestRunning] = useState(false);
  const [reingestTyped, setReingestTyped] = useState("");

  function closeReingest() {
    setReingestRunning(false);
    setReingestTyped("");
  }

  async function addTrack(name: string) {
    if (!name.trim()) return;
    setMutError(null);
    try {
      const res = await fetch("/api/backstage/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, name: name.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      console.error("[GameDetail] addTrack failed:", err);
      setMutError("Failed to add track. Please try again.");
    }
  }

  async function importPastedTracks(tracks: ParsedTrack[]) {
    if (tracks.length === 0) return;
    setMutError(null);
    try {
      const res = await fetch("/api/backstage/import-tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, tracks }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      console.error("[GameDetail] importPastedTracks failed:", err);
      setMutError("Failed to import tracks. Please try again.");
    }
  }

  async function markTracksReady() {
    setMutError(null);
    try {
      const res = await fetch(`/api/backstage/games/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarding_phase: "tracks_loaded" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      console.error("[GameDetail] markTracksReady failed:", err);
      setMutError("Failed to update phase. Please try again.");
    }
  }

  async function handleTrackSave(gameId: string, name: string, updates: PatchUpdates) {
    setMutError(null);
    try {
      const { videoId, durationSeconds, viewCount, ...trackUpdates } = updates;
      const body: Record<string, unknown> = { gameId, name, updates: trackUpdates };
      if (videoId) {
        body.videoUpdates = { videoId, durationSeconds, viewCount };
      }
      const res = await fetch("/api/backstage/tracks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      console.error("[GameDetail] handleTrackSave failed:", err);
      setMutError("Failed to save track. Please try again.");
    }
  }

  async function togglePublished() {
    setPublishing(true);
    setMutError(null);
    try {
      const res = await fetch("/api/backstage/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, published: !game.published }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      console.error("[GameDetail] togglePublished failed:", err);
      setMutError("Failed to update published status.");
    } finally {
      setPublishing(false);
    }
  }

  async function saveField(field: string, value: string | null) {
    setMutError(null);
    let payload: unknown = value === "" ? null : value;
    if (field === "steam_appid") {
      payload = value ? Number(value) : null;
    }
    try {
      const res = await fetch(`/api/backstage/games/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: payload }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      console.error(`[GameDetail] saveField(${field}) failed:`, err);
      setMutError(`Failed to update ${field}.`);
    }
  }

  async function toggleTrackActive(track: Track) {
    try {
      await fetch("/api/backstage/tracks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: game.id,
          name: track.name,
          updates: { active: !track.active },
        }),
      });
      router.refresh();
    } catch (err) {
      console.error("[GameDetail] toggleTrackActive failed:", err);
      setMutError("Failed to toggle track.");
    }
  }

  async function reviewDiscovered(approve: string[], reject: string[]) {
    setMutError(null);
    try {
      const res = await fetch("/api/backstage/tracks/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, approve, reject }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      console.error("[GameDetail] reviewDiscovered failed:", err);
      setMutError("Failed to review tracks.");
    }
  }

  async function deleteTrack(track: Track) {
    try {
      await fetch("/api/backstage/tracks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, names: [track.name] }),
      });
      router.refresh();
    } catch (err) {
      console.error("[GameDetail] deleteTrack failed:", err);
      setMutError("Failed to delete track.");
    }
  }

  async function deleteGame() {
    setNuking(true);
    try {
      const res = await fetch(`/api/backstage/games/${game.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.push("/backstage/games");
    } catch (err) {
      console.error("[GameDetail] nuke failed:", err);
      setMutError("Failed to delete game. Please try again.");
      setNuking(false);
    }
  }

  async function clearAllFlags() {
    await fetch("/api/backstage/review-flags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: game.id }),
    });
    router.refresh();
  }

  async function clearSingleFlag(flagId: number) {
    await fetch("/api/backstage/review-flags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagId, gameId: game.id }),
    });
    router.refresh();
  }

  return {
    mutError,
    setMutError,
    publishing,
    sseRunning,
    setSseRunning,
    nuking,
    reingestRunning,
    setReingestRunning,
    reingestTyped,
    setReingestTyped,
    closeReingest,
    addTrack,
    importPastedTracks,
    markTracksReady,
    handleTrackSave,
    togglePublished,
    saveField,
    toggleTrackActive,
    reviewDiscovered,
    deleteTrack,
    deleteGame,
    clearAllFlags,
    clearSingleFlag,
  };
}

export type GameDetailActions = ReturnType<typeof useGameDetailActions>;
