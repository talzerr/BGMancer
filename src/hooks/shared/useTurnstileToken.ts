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
   * then renders the widget. Resolves with `null` if the widget never
   * completes its challenge within `RENDER_TIMEOUT_MS` (covers privacy
   * browsers, blocked third-party cookies, headless UAs). Resolves with
   * `""` for synchronous failure paths (missing sitekey / script / container).
   * Caller should treat both `null` and `""` as "no token" and surface a
   * user-facing error instead of hanging the UI.
   */
  getToken: () => Promise<string | null>;
}

const READY_TIMEOUT_MS = 5000;
// Hard cap on waiting for the Turnstile widget to produce a token. If the
// widget never fires its callback within this window (silent failure in
// privacy browsers, blocked third-party cookies, headless UA) we give up and
// surface an error rather than let the caller's generation promise dangle.
const RENDER_TIMEOUT_MS = 15000;

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

  const getToken = useCallback(async (): Promise<string | null> => {
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

    // Race the widget callbacks against a hard timeout. Privacy browsers and
    // headless UAs can silently stall the challenge without firing any of
    // Turnstile's callbacks — without this race, `getToken` never resolves.
    const tokenPromise = new Promise<string>((resolve) => {
      turnstile.render(container, {
        sitekey: siteKey,
        callback: resolve,
        "error-callback": () => resolve(""),
        "expired-callback": () => resolve(""),
      });
    });

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), RENDER_TIMEOUT_MS),
    );

    const result = await Promise.race([tokenPromise, timeoutPromise]);
    if (result === null) {
      console.warn("[useTurnstileToken] widget did not resolve within timeout");
    }
    return result;
  }, [siteKey]);

  return { containerRef, scriptOnReady, getToken };
}
