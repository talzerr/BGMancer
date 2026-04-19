import { getDB } from "@/lib/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { gameRequests } from "@/lib/db/drizzle-schema";

export interface GameRequest {
  igdbId: number;
  name: string;
  coverUrl: string | null;
  requestCount: number;
  acknowledged: boolean;
  createdAt: string;
  updatedAt: string;
}

function rowToRequest(row: typeof gameRequests.$inferSelect): GameRequest {
  return {
    igdbId: row.igdb_id,
    name: row.name,
    coverUrl: row.cover_url,
    requestCount: row.request_count,
    acknowledged: row.acknowledged,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const GameRequests = {
  /** New → insert; existing & unacknowledged → increment; acknowledged → no-op. */
  async upsertRequest(igdbId: number, name: string, coverUrl: string | null): Promise<GameRequest> {
    const db = getDB();
    const now = new Date().toISOString();
    await db.run(sql`
      INSERT INTO game_requests (igdb_id, name, cover_url, request_count, acknowledged, created_at, updated_at)
      VALUES (${igdbId}, ${name}, ${coverUrl}, 1, 0, ${now}, ${now})
      ON CONFLICT(igdb_id) DO UPDATE SET
        request_count = request_count + 1,
        updated_at = ${now}
      WHERE acknowledged = 0
    `);
    const row = await db.select().from(gameRequests).where(eq(gameRequests.igdb_id, igdbId)).get();
    return rowToRequest(row!);
  },

  async getUnacknowledged(): Promise<GameRequest[]> {
    const rows = await getDB()
      .select()
      .from(gameRequests)
      .where(eq(gameRequests.acknowledged, false))
      .orderBy(desc(gameRequests.request_count), desc(gameRequests.updated_at))
      .all();
    return rows.map(rowToRequest);
  },

  async getAll(): Promise<GameRequest[]> {
    const rows = await getDB()
      .select()
      .from(gameRequests)
      .orderBy(desc(gameRequests.request_count), desc(gameRequests.updated_at))
      .all();
    return rows.map(rowToRequest);
  },

  /** Idempotent — already-acknowledged or nonexistent rows are no-ops. */
  async acknowledge(igdbId: number): Promise<void> {
    await getDB()
      .update(gameRequests)
      .set({ acknowledged: true })
      .where(and(eq(gameRequests.igdb_id, igdbId), eq(gameRequests.acknowledged, false)))
      .run();
  },
};
