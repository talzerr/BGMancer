import { getDB } from "@/lib/db";
import { and, desc, eq } from "drizzle-orm";
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
  /**
   * Idempotent request registration.
   * - New igdb_id → insert with count=1
   * - Existing, not acknowledged → increment count + touch updated_at
   * - Existing, acknowledged → no-op (the admin has already seen it)
   */
  async upsertRequest(igdbId: number, name: string, coverUrl: string | null): Promise<GameRequest> {
    const db = getDB();
    const now = new Date().toISOString();
    const existing = await db
      .select()
      .from(gameRequests)
      .where(eq(gameRequests.igdb_id, igdbId))
      .get();

    if (!existing) {
      await db
        .insert(gameRequests)
        .values({
          igdb_id: igdbId,
          name,
          cover_url: coverUrl,
          request_count: 1,
          acknowledged: false,
          created_at: now,
          updated_at: now,
        })
        .run();
      const inserted = await db
        .select()
        .from(gameRequests)
        .where(eq(gameRequests.igdb_id, igdbId))
        .get();
      return rowToRequest(inserted!);
    }

    if (!existing.acknowledged) {
      await db
        .update(gameRequests)
        .set({ request_count: existing.request_count + 1, updated_at: now })
        .where(eq(gameRequests.igdb_id, igdbId))
        .run();
      return rowToRequest({
        ...existing,
        request_count: existing.request_count + 1,
        updated_at: now,
      });
    }

    return rowToRequest(existing);
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

  async acknowledge(igdbId: number): Promise<void> {
    await getDB()
      .update(gameRequests)
      .set({ acknowledged: true })
      .where(and(eq(gameRequests.igdb_id, igdbId), eq(gameRequests.acknowledged, false)))
      .run();
  },
};
