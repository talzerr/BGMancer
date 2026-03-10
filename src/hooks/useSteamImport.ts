"use client";

import { useState } from "react";

export interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
}

export interface SteamImportResult {
  imported: number;
  skipped: number;
  omitted: number;
}

export function useSteamImport() {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [steamGames, setSteamGames] = useState<SteamGame[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SteamImportResult | null>(null);

  async function findGames(input: string): Promise<void> {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setSteamGames(null);
    setResult(null);

    try {
      const res = await fetch(`/api/steam/games?input=${encodeURIComponent(input.trim())}`);
      const data = (await res.json()) as { games?: SteamGame[]; error?: string };

      if (!res.ok) {
        if (data.error === "private") {
          setError("private");
        } else if (data.error === "not_found") {
          setError("Your Steam profile URL or username wasn't found. Check the URL and try again.");
        } else if (data.error === "missing_key") {
          setError("STEAM_API_KEY is not configured on the server.");
        } else {
          setError("Something went wrong fetching your Steam library.");
        }
        return;
      }

      setSteamGames(data.games ?? []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Submits the given games to the import endpoint.
   * Returns true on success so the caller can reset its own local state (e.g. clear the input).
   */
  async function importGames(games: SteamGame[]): Promise<boolean> {
    if (games.length === 0) return false;
    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/steam/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ games }),
      });
      const data = (await res.json()) as {
        imported?: number;
        skipped?: number;
        omitted?: number;
        error?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "Import failed.");
        return false;
      }

      setResult({
        imported: data.imported ?? 0,
        skipped: data.skipped ?? 0,
        omitted: data.omitted ?? 0,
      });
      setSteamGames(null);
      return true;
    } catch {
      setError("Network error. Please try again.");
      return false;
    } finally {
      setImporting(false);
    }
  }

  return { loading, importing, steamGames, error, result, findGames, importGames };
}
