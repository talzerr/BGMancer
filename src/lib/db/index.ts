/* eslint-disable @typescript-eslint/no-explicit-any -- Drizzle's batch() API requires any[] for heterogeneous query arrays */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./drizzle-schema";

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

/** Returns a Drizzle-wrapped D1 database instance. */
export function getDB(): DrizzleDB {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}

/** D1 supports at most 100 statements per batch call. */
const D1_BATCH_LIMIT = 100;

/**
 * Execute multiple queries in a single batch (D1 sends them in one HTTP roundtrip).
 * Automatically chunks into multiple batch calls if the list exceeds D1's 100-statement limit.
 */
export async function batch(queries: any[]): Promise<void> {
  if (queries.length === 0) return;
  const db = getDB();
  for (let i = 0; i < queries.length; i += D1_BATCH_LIMIT) {
    await db.batch(queries.slice(i, i + D1_BATCH_LIMIT) as [any]);
  }
}
