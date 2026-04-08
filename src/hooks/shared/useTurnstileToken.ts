"use client";

import { useCallback, useRef } from "react";

interface ReadyHandle {
  promise: Promise<void>;
  resolve: () => void;
}

interface UseTurnstileTokenResult {
  /** Attach to the hidden div that hosts the Turnstile widget. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Pass to the Turnstile `<Script>`'s `onReady` prop. */
  scriptOnReady: () => void;
  /**
   * Resolve a fresh token. Waits up to `timeoutMs` for the script to load,
   * then renders the widget. Resolves with `""` on any failure — caller is
   * responsible for handling an empty token (the server will reject it).
   */
  getToken: () => Promise<string>;
}

const READY_TIMEOUT_MS = 5000;

/**
 * Cloudflare Turnstile widget plumbing. Both guest playlist generation and
 * the catalog game request flow share this exact pattern: render the script
 * `afterInteractive`, mount an invisible widget on demand, race the ready
 * signal against a timeout so the action still fires if Turnstile is slow.
 */
export function useTurnstileToken(siteKey: string | undefined): UseTurnstileTokenResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef<ReadyHandle | null>(null);

  if (readyRef.current === null) {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    readyRef.current = { promise, resolve };
  }

  const scriptOnReady = useCallback(() => {
    readyRef.current?.resolve();
  }, []);

  const getToken = useCallback(async (): Promise<string> => {
    if (!siteKey) return "";

    const ready = readyRef.current;
    if (ready) {
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, READY_TIMEOUT_MS));
      await Promise.race([ready.promise, timeout]);
    }

    const turnstile = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    if (!turnstile) return "";
    const container = containerRef.current;
    if (!container) return "";

    return new Promise<string>((resolve) => {
      turnstile.render(container, {
        sitekey: siteKey,
        callback: resolve,
        "error-callback": () => resolve(""),
        "expired-callback": () => resolve(""),
      });
    });
  }, [siteKey]);

  return { containerRef, scriptOnReady, getToken };
}
