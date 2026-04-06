/**
 * IP-based rate limiter backed by the KV service.
 *
 * Stores an array of timestamps per key. Entries auto-expire via KV TTL.
 */

import { KV } from "@/lib/services/infra/kv";
import { USER_DAILY_LLM_CAP, GUEST_MAX_REQUESTS, GUEST_WINDOW_MS } from "@/lib/constants";

/**
 * Check if a request from `key` is within the rate limit.
 * Returns { allowed: true } or { allowed: false, retryAfterMs }.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }> {
  const kvKey = `ratelimit:${key}`;
  const now = Date.now();
  const cutoff = now - windowMs;

  const stored = await KV.get<number[]>(kvKey);
  const timestamps = Array.isArray(stored) ? stored.filter((t) => t > cutoff) : [];

  if (timestamps.length >= maxRequests) {
    const oldestInWindow = timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    return { allowed: false, retryAfterMs };
  }

  timestamps.push(now);
  await KV.set(kvKey, timestamps, Math.ceil(windowMs / 1000));
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

/**
 * Shared rate limiter for all guest (unauthenticated) requests.
 * Single bucket per IP across all guest-accessible routes.
 * Returns null if allowed, or a { waitSec } object if rate-limited.
 */
export async function checkGuestRateLimit(request: Request): Promise<{ waitSec: number } | null> {
  const ip = getClientIp(request);
  const result = await checkRateLimit(`guest:${ip}`, GUEST_MAX_REQUESTS, GUEST_WINDOW_MS);
  if (result.allowed) return null;
  return { waitSec: Math.ceil(result.retryAfterMs / 1000) };
}

// ─── Per-user daily generation cap ──────────────────────────────────────────

const DAY_IN_SECONDS = 86400;

function dailyCapKey(userId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `gencap:${userId}:${today}`;
}

/**
 * Check and consume a daily LLM generation slot for a logged-in user.
 * Returns null if allowed (and increments the count), or an error message if capped.
 * Resets at midnight UTC.
 */
export async function acquireLlmGeneration(userId: string): Promise<{ error: string } | null> {
  const key = dailyCapKey(userId);
  const count = (await KV.get<number>(key)) ?? 0;

  if (count >= USER_DAILY_LLM_CAP) {
    return { error: "Daily generation limit reached. Try again tomorrow." };
  }

  await KV.set(key, count + 1, DAY_IN_SECONDS);
  return null;
}
