"use client";

import { useState } from "react";
import type { BackstageGame } from "@/lib/db/repos/backstage-games";

interface UseGameSelectionOptions {
  games: BackstageGame[];
  refetch: () => Promise<void>;
}

export function useGameSelection({ games, refetch }: UseGameSelectionOptions) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPublishing, setBulkPublishing] = useState(false);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === games.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(games.map((g) => g.id)));
    }
  }

  async function handleBulkPublish(published: boolean) {
    if (selectedIds.size === 0) return;
    setBulkPublishing(true);
    try {
      const res = await fetch("/api/backstage/bulk-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameIds: [...selectedIds], published }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSelectedIds(new Set());
      await refetch();
    } catch (err) {
      console.error("[GamesClient] bulk publish failed:", err);
    } finally {
      setBulkPublishing(false);
    }
  }

  return {
    selectedIds,
    setSelectedIds,
    bulkPublishing,
    toggleSelect,
    toggleSelectAll,
    handleBulkPublish,
  };
}
