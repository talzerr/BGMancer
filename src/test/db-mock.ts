import type { DrizzleDB } from "@/lib/db";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * PGlite's `execute()` resolves to a result object (`{ rows, fields, … }`) while
 * the production postgres-js driver resolves to a plain row array. Repos are
 * written against the latter, so unwrap `.rows` before it reaches them.
 */
function unwrapRows(result: any): any {
  return result && typeof result === "object" && Array.isArray(result.rows) ? result.rows : result;
}

/**
 * Builds the `@/lib/db` mock surface over a PGlite-backed Drizzle instance.
 * `getDb` is a thunk because the instance is assigned in `beforeAll`, after the
 * hoisted `vi.mock` factory has already run.
 */
export function createDbMock(getDb: () => DrizzleDB) {
  return {
    getDB: () =>
      new Proxy(getDb() as any, {
        get(target, prop) {
          if (prop === "execute") return (query: any) => target.execute(query).then(unwrapRows);
          const value = Reflect.get(target, prop);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }),

    batch: async (queries: any[]) => {
      if (queries.length === 0) return;
      await (getDb() as any).transaction(async (tx: any) => {
        for (const query of queries) await tx.execute(query.getSQL());
      });
    },

    first: async (query: PromiseLike<any[]>) => (await query)[0],
  };
}
