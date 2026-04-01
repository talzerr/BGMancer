/**
 * Simple in-memory IP-based rate limiter.
 * Uses a sliding window per key. Not distributed — works for single-process deployments.
 * In production on Cloudflare Workers, replace with Workers Rate Limiting binding.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

/** Periodically purge expired entries to prevent memory leaks. */
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

/**
 * Check if a request from `key` is within the rate limit.
 * Returns { allowed: true } or { allowed: false, retryAfterMs }.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  cleanup(windowMs);

  const now = Date.now();
  const cutoff = now - windowMs;
  const entry = store.get(key) ?? { timestamps: [] };

  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    return { allowed: false, retryAfterMs };
  }

  entry.timestamps.push(now);
  store.set(key, entry);
  return { allowed: true };
}

/** Extract client IP from request headers. */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ─── Guest rate limiter ─────────────────────────────────────────────────────

const GUEST_MAX_REQUESTS = 10;
const GUEST_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Shared rate limiter for all guest (unauthenticated) requests.
 * Single bucket per IP across all guest-accessible routes.
 * Returns null if allowed, or a { waitSec } object if rate-limited.
 */
export function checkGuestRateLimit(request: Request): { waitSec: number } | null {
  const ip = getClientIp(request);
  const result = checkRateLimit(`guest:${ip}`, GUEST_MAX_REQUESTS, GUEST_WINDOW_MS);
  if (result.allowed) return null;
  return { waitSec: Math.ceil(result.retryAfterMs / 1000) };
}
