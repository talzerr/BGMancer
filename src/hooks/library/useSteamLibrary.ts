"use client";

import { useCallback, useEffect, useState } from "react";

interface SteamLibraryResponse {
  linked: boolean;
  steamSyncedAt?: string;
  matchedGameIds?: string[];
}

export function useSteamLibrary(isSignedIn: boolean) {
  const [linked, setLinked] = useState(false);
  const [steamSyncedAt, setSteamSyncedAt] = useState<string | null>(null);
  const [matchedGameIds, setMatchedGameIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLibrary = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/steam/library");
      if (!res.ok) {
        setError("Could not load Steam library.");
        return false;
      }
      const data: SteamLibraryResponse = await res.json();
      if (data.linked) {
        setLinked(true);
        setSteamSyncedAt(data.steamSyncedAt ?? null);
        setMatchedGameIds(data.matchedGameIds ?? []);
      } else {
        setLinked(false);
        setSteamSyncedAt(null);
        setMatchedGameIds([]);
      }
      return true;
    } catch (err) {
      console.error("Failed to fetch Steam library:", err);
      setError("Could not load Steam library.");
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      if (!isSignedIn) {
        setLinked(false);
        setSteamSyncedAt(null);
        setMatchedGameIds([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      await fetchLibrary();
      if (!cancelled) setIsLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, fetchLibrary]);

  async function sync(steamUrl?: string): Promise<boolean> {
    setError(null);
    setIsSyncing(true);
    try {
      const res = await fetch("/api/steam/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(steamUrl ? { steamUrl } : {}),
      });
      if (!res.ok) {
        let message = "Steam sync failed.";
        try {
          const body = (await res.json()) as { error?: string };
          if (body && typeof body.error === "string") message = body.error;
        } catch {
          /* ignore parse errors */
        }
        setError(message);
        return false;
      }
      await fetchLibrary();
      return true;
    } catch (err) {
      console.error("Failed to sync Steam library:", err);
      setError("Could not reach server.");
      return false;
    } finally {
      setIsSyncing(false);
    }
  }

  async function disconnect(): Promise<boolean> {
    setError(null);
    try {
      const res = await fetch("/api/steam/link", { method: "DELETE" });
      if (!res.ok) {
        setError("Could not disconnect Steam account.");
        return false;
      }
      setLinked(false);
      setSteamSyncedAt(null);
      setMatchedGameIds([]);
      return true;
    } catch (err) {
      console.error("Failed to disconnect Steam:", err);
      setError("Could not reach server.");
      return false;
    }
  }

  return {
    linked,
    steamSyncedAt,
    matchedGameIds,
    isLoading,
    error,
    isSyncing,
    sync,
    disconnect,
  };
}
