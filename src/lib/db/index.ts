import { drizzle } from "drizzle-orm/postgres-js";
import { type SQLWrapper } from "drizzle-orm";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./drizzle-schema";

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

// postgres-js over node-postgres: `db.execute(sql`…`)` returns a plain row array,
// matching the D1 `.all()` semantics the repos were written against.
// The pool is module-level because the Node process is long-lived, unlike
// Cloudflare Workers where a connection was created per request.
let _db: DrizzleDB | null = null;

/** Returns a Drizzle-wrapped Postgres instance backed by a shared pool. */
export function getDB(): DrizzleDB {
  if (!_db) {
    const client = postgres(env.databaseUrl, { max: 10, prepare: false });
    _db = drizzle(client, { schema });
  }
  return _db;
}

/** Execute multiple queries atomically in a single transaction. */
export async function batch(queries: SQLWrapper[]): Promise<void> {
  if (queries.length === 0) return;
  await getDB().transaction(async (tx) => {
    for (const query of queries) {
      await tx.execute(query.getSQL());
    }
  });
}

/** Returns the first row of a query, or undefined. Replaces D1's `.get()`. */
export async function first<T>(query: PromiseLike<T[]>): Promise<T | undefined> {
  const rows = await query;
  return rows[0];
}
