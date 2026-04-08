"use client";

import { useCallback, useRef, type FocusEvent } from "react";
import Image from "next/image";
import Script from "next/script";
import { SearchIcon, Spinner } from "@/components/Icons";
import { useGameRequest, type IgdbSearchResult } from "@/hooks/library/useGameRequest";

interface GameRequestPromptProps {
  catalogSearch: string;
  requestFormEnabled: boolean;
  turnstileSiteKey: string | undefined;
}

function EmptyStateShell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <SearchIcon className="h-9 w-9 text-[var(--text-disabled)]" />
      <p className="text-xs text-[var(--text-tertiary)]">No games found</p>
      {children}
    </div>
  );
}

export function GameRequestPrompt({
  catalogSearch,
  requestFormEnabled,
  turnstileSiteKey,
}: GameRequestPromptProps) {
  const {
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
  } = useGameRequest({ catalogSearch, enabled: requestFormEnabled });

  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileReadyRef = useRef<{
    promise: Promise<void>;
    resolve: () => void;
  } | null>(null);

  function getTurnstileReady() {
    if (!turnstileReadyRef.current) {
      let resolve!: () => void;
      const promise = new Promise<void>((r) => {
        resolve = r;
      });
      turnstileReadyRef.current = { promise, resolve };
    }
    return turnstileReadyRef.current;
  }

  const getTurnstileToken = useCallback(async (): Promise<string> => {
    if (!turnstileSiteKey) return "";
    // Wait for Turnstile (afterInteractive) up to 5s; fall through on timeout.
    const ready = getTurnstileReady();
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5000));
    await Promise.race([ready.promise, timeout]);

    const turnstile = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    if (!turnstile) return "";
    const container = turnstileRef.current;
    if (!container) return "";
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
    const turnstileToken = await getTurnstileToken();
    await submitRequest(result, turnstileToken);
  }

  // Degraded: IGDB or Turnstile not configured.
  if (!requestFormEnabled || degraded) {
    return <EmptyStateShell />;
  }

  if (submittedName) {
    return (
      <EmptyStateShell>
        <p className="text-xs text-[var(--text-secondary)]">Request received for {submittedName}</p>
      </EmptyStateShell>
    );
  }

  const trimmed = query.trim();
  const showDropdown = activated && trimmed.length > 0;
  const previewMode = !activated && catalogSearch.trim().length > 0;
  const inputValue = activated ? query : previewMode ? catalogSearch : "";

  function handleFocus(e: FocusEvent<HTMLInputElement>) {
    if (activated) return;
    activate();
    const len = catalogSearch.length;
    requestAnimationFrame(() => {
      e.target.setSelectionRange(len, len);
    });
  }

  return (
    <>
      {turnstileSiteKey && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="afterInteractive"
            onReady={() => {
              getTurnstileReady().resolve();
            }}
          />
          <div ref={turnstileRef} className="hidden" />
        </>
      )}
      <EmptyStateShell>
        <p className="text-xs text-[var(--text-secondary)]">Request a game</p>

        <div className="relative w-full max-w-[260px]">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={handleFocus}
            placeholder={previewMode ? undefined : "Search for a game..."}
            readOnly={!activated}
            disabled={submitting}
            className={`w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-elevated)] px-3 py-2 text-[13px] focus:border-[var(--primary)] focus:outline-none disabled:opacity-50 ${
              activated ? "text-[var(--text-primary)]" : "text-[var(--text-disabled)]"
            } placeholder:text-[var(--text-disabled)]`}
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
                <p className="px-3 py-2 text-xs text-[var(--text-tertiary)]">No matches</p>
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
      </EmptyStateShell>
    </>
  );
}
