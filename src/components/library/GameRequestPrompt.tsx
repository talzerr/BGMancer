"use client";

import { type FocusEvent } from "react";
import Image from "next/image";
import Script from "next/script";
import { SearchIcon, Spinner } from "@/components/Icons";
import { useGameRequest, type IgdbSearchResult } from "@/hooks/library/useGameRequest";
import { useTurnstileToken } from "@/hooks/shared/useTurnstileToken";

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

  const {
    containerRef: turnstileContainerRef,
    scriptOnReady: turnstileScriptOnReady,
    getToken: getTurnstileToken,
  } = useTurnstileToken(turnstileSiteKey);

  async function handleSelect(result: IgdbSearchResult) {
    const token = await getTurnstileToken();
    await submitRequest(result, token);
  }

  // Degraded: IGDB or Turnstile not configured.
  if (!requestFormEnabled || degraded) {
    return <EmptyStateShell />;
  }

  if (submittedName) {
    return (
      <EmptyStateShell>
        <p className="text-muted-foreground text-xs">Request received for {submittedName}</p>
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
            onReady={turnstileScriptOnReady}
          />
          <div ref={turnstileContainerRef} className="hidden" />
        </>
      )}
      <EmptyStateShell>
        <p className="text-muted-foreground text-xs">Request a game</p>

        <div className="relative w-full max-w-[260px]">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={handleFocus}
            placeholder={previewMode ? undefined : "Search for a game..."}
            readOnly={!activated}
            disabled={submitting}
            className={`border-border bg-secondary focus:border-primary w-full rounded-md border px-3 py-2 text-[13px] focus:outline-none disabled:opacity-50 ${
              activated ? "text-foreground" : "text-[var(--text-disabled)]"
            } placeholder:text-[var(--text-disabled)]`}
          />

          {showDropdown && (
            <div className="border-border absolute top-full left-0 z-10 mt-1 w-full overflow-hidden rounded-md border border-[var(--border-emphasis)] bg-[var(--surface-elevated)]">
              {isLoading ? (
                <div className="flex items-center gap-2 px-3 py-2">
                  <Spinner className="h-3 w-3 text-[var(--text-disabled)]" />
                  <span className="text-xs text-[var(--text-disabled)]">Searching...</span>
                </div>
              ) : error ? (
                <p className="text-destructive px-3 py-2 text-xs">{error}</p>
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
                        className="hover:bg-accent flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors duration-100 disabled:opacity-50"
                      >
                        <div className="bg-accent flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded">
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
                        <span className="text-foreground truncate text-[13px]">{r.name}</span>
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
