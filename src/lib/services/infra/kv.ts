/* eslint-disable @typescript-eslint/no-require-imports -- Lazy require() for @opennextjs/cloudflare avoids import errors in test/dev environments */
import { env } from "@/lib/env";

/**
 * Key-value cache service with TTL support.
 *
 * - Production (Cloudflare Workers): backed by KV namespace.
 * - Local dev / tests: backed by an in-memory Map with manual expiry.
 *
 * Usage:
 *   import { KV } from "@/lib/services/infra/kv";
 *   await KV.set("key", { foo: 1 }, 3600);  // TTL in seconds
 *   const val = await KV.get<{ foo: number }>("key");
 *   await KV.del("key");
 */

// ---------------------------------------------------------------------------
// In-memory backend (local dev / tests)
// ---------------------------------------------------------------------------

interface MemEntry {
  value: string;
  expiresAt: number | null; // null = no expiry
}

const memStore = new Map<string, MemEntry>();

function memGet(key: string): string | null {
  const entry = memStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
    memStore.delete(key);
    return null;
  }
  return entry.value;
}

function memSet(key: string, value: string, ttlSeconds?: number): void {
  memStore.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
  });
}

function memDel(key: string): void {
  memStore.delete(key);
}

// ---------------------------------------------------------------------------
// KV backend (Cloudflare Workers)
// ---------------------------------------------------------------------------

function getKV(): KVNamespace {
  const { getCloudflareContext } = require("@opennextjs/cloudflare");
  return getCloudflareContext().env.CACHE;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function isProduction(): boolean {
  return !env.isDev;
}

export const KV = {
  /**
   * Get a value by key. Returns null if not found or expired.
   */
  async get<T = string>(key: string): Promise<T | null> {
    if (!isProduction()) {
      const raw = memGet(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    }
    return getKV().get(key, "json");
  },

  /**
   * Get a raw string value by key. Returns null if not found or expired.
   */
  async getString(key: string): Promise<string | null> {
    if (!isProduction()) {
      return memGet(key);
    }
    return getKV().get(key, "text");
  },

  /**
   * Set a value with optional TTL (in seconds).
   * Value is JSON-serialized.
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (!isProduction()) {
      memSet(key, serialized, ttlSeconds);
      return;
    }
    const opts: KVNamespacePutOptions = {};
    if (ttlSeconds) opts.expirationTtl = ttlSeconds;
    await getKV().put(key, serialized, opts);
  },

  /**
   * Delete a key.
   */
  async del(key: string): Promise<void> {
    if (!isProduction()) {
      memDel(key);
      return;
    }
    await getKV().delete(key);
  },

  /**
   * Check if a key exists (without parsing the value).
   */
  async has(key: string): Promise<boolean> {
    if (!isProduction()) {
      return memGet(key) !== null;
    }
    return (await getKV().get(key, "text")) !== null;
  },
};
