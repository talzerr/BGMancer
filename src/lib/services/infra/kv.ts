/**
 * Key-value cache service with TTL support.
 *
 * Backed by an in-process Map with manual expiry. State lives in the running
 * process and **resets on restart** — a deliberate trade-off for the
 * single-replica LAN deployment. In practice this means guest rate limits and
 * the per-user daily LLM cap reset whenever the pod restarts.
 *
 * Usage:
 *   import { KV } from "@/lib/services/infra/kv";
 *   await KV.set("key", { foo: 1 }, 3600);  // TTL in seconds
 *   const val = await KV.get<{ foo: number }>("key");
 *   await KV.del("key");
 */

// ---------------------------------------------------------------------------
// In-memory backend
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
// Public API
// ---------------------------------------------------------------------------

export const KV = {
  /**
   * Get a value by key. Returns null if not found or expired.
   */
  async get<T = string>(key: string): Promise<T | null> {
    const raw = memGet(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  },

  /**
   * Get a raw string value by key. Returns null if not found or expired.
   */
  async getString(key: string): Promise<string | null> {
    return memGet(key);
  },

  /**
   * Set a value with optional TTL (in seconds).
   * Value is JSON-serialized.
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    memSet(key, JSON.stringify(value), ttlSeconds);
  },

  /**
   * Delete a key.
   */
  async del(key: string): Promise<void> {
    memDel(key);
  },

  /**
   * Check if a key exists (without parsing the value).
   */
  async has(key: string): Promise<boolean> {
    return memGet(key) !== null;
  },
};
