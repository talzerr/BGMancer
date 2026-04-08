"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Script from "next/script";
import { SearchIcon, Spinner } from "@/components/Icons";

interface IgdbSearchResult {
  igdbId: number;
  name: string;
  coverUrl: string | null;
}

interface GameRequestPromptProps {
  /** The current catalog search string — used to reset the submitted state. */
  catalogSearch: string;
  /** Whether the server has both IGDB credentials and a Turnstile site key. */
  requestFormEnabled: boolean;
  /** Cloudflare Turnstile site key, passed through from the server component. */
  turnstileSiteKey: string | undefined;
}

const DEBOUNCE_MS = 300;

export function GameRequestPrompt({
  catalogSearch,
  requestFormEnabled,
  turnstileSiteKey,
}: GameRequestPromptProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IgdbSearchResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedName, setSubmittedName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Set to true if the search-igdb endpoint returns 404 at runtime. */
  const [degraded, setDegraded] = useState(false);

  const turnstileRef = useRef<HTMLDivElement>(null);

  // ── Reset "submitted" state whenever the catalog search input changes ──
  useEffect(() => {
    setSubmittedName(null);
    setQuery("");
    setResults(null);
    setError(null);
  }, [catalogSearch]);

  // ── Debounced IGDB search ─────────────────────────────────────────────
  useEffect(() => {
    if (!requestFormEnabled || degraded) return;
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
  }, [query, requestFormEnabled, degraded]);

  const getTurnstileToken = useCallback((): Promise<string> => {
    const turnstile = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    if (!turnstile || !turnstileSiteKey) return Promise.resolve("");
    const container = turnstileRef.current;
    if (!container) return Promise.resolve("");
    return new Promise<string>((resolve) => {
      turnstile.render(container, {
        sitekey: turnstileSiteKey,
        callback: resolve,
        "error-callback": () => resolve(""),
        "expired-callback": () => resolve(""),
      });
    });
  }, [turnstileSiteKey]);

  async function handleSelect(result: IgdbSearchResult) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const turnstileToken = await getTurnstileToken();
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
  }

  // ── Render ────────────────────────────────────────────────────────────

  // Degraded: IGDB or Turnstile not configured → just the empty label.
  if (!requestFormEnabled || degraded) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <SearchIcon className="h-9 w-9 text-[var(--text-disabled)]" />
        <p className="text-xs text-[var(--text-tertiary)]">No games found.</p>
      </div>
    );
  }

  // Submitted: input and dropdown replaced with confirmation.
  if (submittedName) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <SearchIcon className="h-9 w-9 text-[var(--text-disabled)]" />
        <p className="text-xs text-[var(--text-tertiary)]">No games found.</p>
        <p className="text-xs text-[var(--text-secondary)]">Request received for {submittedName}</p>
      </div>
    );
  }

  const trimmed = query.trim();
  const showDropdown = trimmed.length > 0;

  return (
    <>
      {turnstileSiteKey && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="lazyOnload"
          />
          <div ref={turnstileRef} className="hidden" />
        </>
      )}
      <div className="flex flex-col items-center gap-3 py-16">
        <SearchIcon className="h-9 w-9 text-[var(--text-disabled)]" />
        <p className="text-xs text-[var(--text-tertiary)]">No games found.</p>
        <p className="text-xs text-[var(--text-secondary)]">Request a game</p>

        <div className="relative w-full max-w-xs">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a game..."
            disabled={submitting}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-elevated)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:border-[var(--primary)] focus:outline-none disabled:opacity-50"
          />

          {showDropdown && (
            <div className="absolute top-full left-0 z-10 mt-1 w-full overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--surface-elevated)] shadow-lg">
              {isLoading ? (
                <div className="flex items-center gap-2 px-3 py-2">
                  <Spinner className="h-3 w-3 text-[var(--text-disabled)]" />
                  <span className="text-xs text-[var(--text-disabled)]">Searching...</span>
                </div>
              ) : error ? (
                <p className="px-3 py-2 text-xs text-[var(--destructive)]">{error}</p>
              ) : results && results.length === 0 ? (
                <p className="px-3 py-2 text-xs text-[var(--text-tertiary)]">No games found.</p>
              ) : results && results.length > 0 ? (
                <ul className="max-h-80 overflow-y-auto">
                  {results.map((r) => (
                    <li key={r.igdbId}>
                      <button
                        type="button"
                        onClick={() => handleSelect(r)}
                        disabled={submitting}
                        className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors duration-100 hover:bg-[var(--surface-hover)] disabled:opacity-50"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded bg-[var(--surface-hover)]">
                          {r.coverUrl ? (
                            <Image
                              src={r.coverUrl}
                              alt=""
                              width={28}
                              height={28}
                              className="h-full w-full object-cover"
                              unoptimized
                            />
                          ) : null}
                        </div>
                        <span className="truncate text-[13px] text-[var(--text-primary)]">
                          {r.name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
