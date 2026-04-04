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

/**
 * Execute multiple queries in a single batch (D1 sends them in one HTTP roundtrip).
 */
export async function batch(queries: any[]): Promise<void> {
  if (queries.length === 0) return;
  await getDB().batch(queries as [any]);
}
