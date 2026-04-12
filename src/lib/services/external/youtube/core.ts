/**
 * Shared YouTube Data API primitives — constants, error classes, URL helpers,
 * and the read-path error parser used by search/OST discovery.
 *
 * OAuth write paths live in ./sync.ts. Onboarding read paths live in
 * ./search.ts (track search + metadata) and ./ost-playlists.ts (playlist
 * discovery + item enumeration). This module owns the cross-cutting pieces
 * the others depend on.
 */

import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";

export const log = createLogger("youtube");

export const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export function getYouTubeApiKey(): string {
  return env.youtubeApiKey ?? "";
}

// ─── Error classes ───────────────────────────────────────────────────────────

/** Thrown when the YouTube Data API quota is exceeded — callers should abort immediately. */
export class YouTubeQuotaError extends Error {
  constructor() {
    super(
      "YouTube API quota exceeded. The free quota resets at midnight Pacific Time (PT). Try again tomorrow or create a new API key at console.cloud.google.com.",
    );
    this.name = "YouTubeQuotaError";
  }
}

/** Thrown when the YouTube API key is missing or invalid — callers should abort immediately. */
export class YouTubeInvalidKeyError extends Error {
  constructor() {
    super(
      "YouTube API key is missing or invalid. Add a valid YOUTUBE_API_KEY to .env.local and restart the server.",
    );
    this.name = "YouTubeInvalidKeyError";
  }
}

/** Parse a YouTube read-path error response body and throw a fatal error if
 *  applicable. Non-fatal errors log and return — the caller decides whether
 *  to retry or return a partial result. */
export async function throwIfFatalError(res: Response): Promise<void> {
  const body = await res.text().catch(() => "");
  log.error("API request failed", {
    url: res.url.split("?")[0],
    status: res.status,
    statusText: res.statusText,
  });
  try {
    const parsed = JSON.parse(body);
    const reason = parsed?.error?.errors?.[0]?.reason;
    log.error("error reason", { reason: reason ?? "unknown" });
    if (reason === "quotaExceeded") throw new YouTubeQuotaError();
    const details: Array<{ reason?: string }> = parsed?.error?.details ?? [];
    if (details.some((d) => d.reason === "API_KEY_INVALID")) throw new YouTubeInvalidKeyError();
  } catch (e) {
    if (e instanceof YouTubeQuotaError || e instanceof YouTubeInvalidKeyError) throw e;
  }
  log.error("response body", { body });
}

// ─── ISO 8601 duration parser ────────────────────────────────────────────────

/** Parse an ISO 8601 duration string (PT1H23M45S) to seconds. */
export function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] ?? "0");
  const minutes = parseInt(match[2] ?? "0");
  const seconds = parseInt(match[3] ?? "0");
  return hours * 3600 + minutes * 60 + seconds;
}

// ─── Title/description rejection filter ─────────────────────────────────────

const REJECT_KEYWORDS = [
  "cover",
  "covers",
  "reaction",
  "reactions",
  "review",
  "reviews",
  "piano",
  "jazz",
  "remix",
  "remixes",
  "fan-made",
  "fan made",
  "arrangement",
  "arranged",
  "lofi",
  "lo-fi",
  "orchestral remix",
];

/** Reject YouTube results whose title/description suggests fan remixes or
 *  unrelated content. Used by the onboarding resolver. */
export function isRejected(title: string, description: string): boolean {
  const haystack = `${title} ${description}`.toLowerCase();
  return REJECT_KEYWORDS.some((kw) => haystack.includes(kw));
}
