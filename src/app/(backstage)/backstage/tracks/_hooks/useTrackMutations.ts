"use client";

import { useCallback } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { BackstageTrackRow } from "@/lib/db/repos/tracks";
import type { PatchUpdates } from "@/components/backstage/TrackEditSheet";
import { trackKey, type TrackKey } from "./useTrackSelection";

interface UseTrackMutationsOptions {
  tracks: BackstageTrackRow[];
  selected: Set<TrackKey>;
  setMutError: (err: string | null) => void;
  setDeleteModalOpen: (open: boolean) => void;
  refetch: () => Promise<void>;
  router: AppRouterInstance;
}

export function useTrackMutations({
  tracks,
  selected,
  setMutError,
  setDeleteModalOpen,
  refetch,
  router,
}: UseTrackMutationsOptions) {
  const patchTracks = useCallback(
    async (patches: { gameId: string; name: string; updates: PatchUpdates }[]) => {
      setMutError(null);
      try {
        const res = await fetch("/api/backstage/tracks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patches),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await refetch();
        router.refresh();
      } catch (err) {
        console.error("[useTrackMutations] patchTracks failed:", err);
        setMutError("Failed to save changes. Please try again.");
      }
    },
    [refetch, router, setMutError],
  );

  function selectedTracks(): BackstageTrackRow[] {
    return tracks.filter((t) => selected.has(trackKey(t)));
  }

  async function bulkSetEnergy(energy: 1 | 2 | 3) {
    const sel = selectedTracks();
    await patchTracks(sel.map((t) => ({ gameId: t.gameId, name: t.name, updates: { energy } })));
  }

  async function bulkSetRole(role: string) {
    const sel = selectedTracks();
    await patchTracks(
      sel.map((t) => ({
        gameId: t.gameId,
        name: t.name,
        updates: { roles: JSON.stringify([role]) },
      })),
    );
  }

  async function bulkSetActive(active: boolean) {
    const sel = selectedTracks();
    await patchTracks(sel.map((t) => ({ gameId: t.gameId, name: t.name, updates: { active } })));
  }

  async function bulkMarkReviewed() {
    setMutError(null);
    try {
      const gameIds = [...new Set(selectedTracks().map((t) => t.gameId))];
      for (const gameId of gameIds) {
        const res = await fetch("/api/backstage/review-flags", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      console.error("[useTrackMutations] bulkMarkReviewed failed:", err);
      setMutError("Failed to clear review flags. Please try again.");
    }
  }

  async function bulkDelete() {
    setMutError(null);
    try {
      const sel = selectedTracks();
      const keys = sel.map((t) => ({ gameId: t.gameId, name: t.name }));
      const res = await fetch("/api/backstage/tracks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDeleteModalOpen(false);
      await refetch();
      router.refresh();
    } catch (err) {
      console.error("[useTrackMutations] bulkDelete failed:", err);
      setMutError("Failed to delete tracks. Please try again.");
      setDeleteModalOpen(false);
    }
  }

  async function handleTrackSave(gameId: string, name: string, updates: PatchUpdates) {
    const { videoId, durationSeconds, viewCount, ...trackUpdates } = updates;
    const body: Record<string, unknown> = { gameId, name, updates: trackUpdates };
    if (videoId) {
      body.videoUpdates = { videoId, durationSeconds, viewCount };
    }
    setMutError(null);
    try {
      const res = await fetch("/api/backstage/tracks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refetch();
    } catch (err) {
      console.error("[useTrackMutations] handleTrackSave failed:", err);
      setMutError("Failed to save track. Please try again.");
    }
  }

  return {
    bulkSetEnergy,
    bulkSetRole,
    bulkSetActive,
    bulkMarkReviewed,
    bulkDelete,
    handleTrackSave,
  };
}
