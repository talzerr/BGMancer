"use client";

import { useCallback, useEffect, useState } from "react";

export interface IgdbSearchResult {
  igdbId: number;
  name: string;
  coverUrl: string | null;
}

interface UseGameRequestOptions {
  /** Catalog search term — when this changes, all internal state resets. */
  catalogSearch: string;
  /** When false, search/submit are no-ops and the hook reports degraded immediately. */
  enabled: boolean;
}

interface UseGameRequestResult {
  query: string;
  setQuery: (q: string) => void;
  results: IgdbSearchResult[] | null;
  isLoading: boolean;
  error: string | null;
  submittedName: string | null;
  submitting: boolean;
  activated: boolean;
  activate: () => void;
  /** True when the search-igdb endpoint is unreachable (404 at runtime). */
  degraded: boolean;
  /** Submit a chosen result. Caller supplies the Turnstile token. */
  submitRequest: (result: IgdbSearchResult, turnstileToken: string) => Promise<void>;
}

const DEBOUNCE_MS = 300;

/**
 * Owns all client-side state, fetches, and effects for the catalog
 * "Request a game" empty state. The component is just rendering + the
 * Turnstile widget plumbing (which is DOM-bound and stays at the UI layer).
 */
export function useGameRequest({
  catalogSearch,
  enabled,
}: UseGameRequestOptions): UseGameRequestResult {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IgdbSearchResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedName, setSubmittedName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activated, setActivated] = useState(false);
  const [degraded, setDegraded] = useState(false);

  // Reset everything whenever the catalog search input changes.
  useEffect(() => {
    setSubmittedName(null);
    setQuery("");
    setResults(null);
    setError(null);
    setActivated(false);
  }, [catalogSearch]);

  // Debounced IGDB search.
  useEffect(() => {
    if (!enabled || degraded) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/games/search-igdb?q=${encodeURIComponent(trimmed)}`);
        if (res.status === 404) {
          if (!cancelled) setDegraded(true);
          return;
        }
        if (!res.ok) {
          if (!cancelled) setError("Couldn't search. Try again.");
          return;
        }
        const data = (await res.json()) as { results: IgdbSearchResult[] };
        if (!cancelled) setResults(data.results);
      } catch {
        if (!cancelled) setError("Couldn't reach server.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, enabled, degraded]);

  const activate = useCallback(() => {
    setActivated(true);
    setQuery(catalogSearch);
  }, [catalogSearch]);

  const submitRequest = useCallback(
    async (result: IgdbSearchResult, turnstileToken: string) => {
      if (submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/games/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            igdbId: result.igdbId,
            name: result.name,
            coverUrl: result.coverUrl,
            turnstileToken,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? "Couldn't submit request. Try again.");
          return;
        }
        setSubmittedName(result.name);
        setResults(null);
        setQuery("");
      } catch {
        setError("Couldn't reach server.");
      } finally {
        setSubmitting(false);
      }
    },
    [submitting],
  );

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    submittedName,
    submitting,
    activated,
    activate,
    degraded,
    submitRequest,
  };
}
