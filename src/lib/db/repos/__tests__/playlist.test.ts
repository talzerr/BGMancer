import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import {
  createTestDrizzleDB,
  seedTestUser,
  seedTestGame,
  seedTestSession,
} from "../../test-helpers";
import type { InsertableTrack } from "../playlist";
let db: DrizzleDB;
let rawDb: Database.Database;

vi.mock("@/lib/db", async () => {
  const { MOCK_LOCAL_USER_ID, MOCK_LOCAL_LIBRARY_ID } = await import("@/test/constants");
  return {
    getDB: () => db,
    batch: async (queries: any[]) => db.batch(queries as [any]),

    LOCAL_USER_ID: MOCK_LOCAL_USER_ID,
    LOCAL_LIBRARY_ID: MOCK_LOCAL_LIBRARY_ID,
  };
});

const { Playlist } = await import("../playlist");

let userId: string;
let gameId: string;
let sessionId: string;

function makeTrack(overrides: Partial<InsertableTrack> & { id: string }): InsertableTrack {
  return {
    game_id: gameId,
    track_name: null,
    video_id: null,
    video_title: null,
    channel_title: null,
    thumbnail: null,
    duration_seconds: null,
    ...overrides,
  };
}

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  ({ userId } = seedTestUser(rawDb));
  gameId = seedTestGame(rawDb, userId);
  sessionId = seedTestSession(rawDb, userId);
});

describe("Playlist", () => {
  describe("replaceAll", () => {
    describe("when inserting tracks into an empty session", () => {
      it("should insert tracks with correct positions", async () => {
        const tracks = [
          makeTrack({ id: "t1", track_name: "Track A" }),
          makeTrack({ id: "t2", track_name: "Track B" }),
          makeTrack({ id: "t3", track_name: "Track C" }),
        ];
        await Playlist.replaceAll(sessionId, tracks);

        const rows = rawDb
          .prepare(
            "SELECT id, position FROM playlist_tracks WHERE playlist_id = ? ORDER BY position",
          )
          .all(sessionId) as Array<{ id: string; position: number }>;
        expect(rows).toHaveLength(3);
        expect(rows[0]).toEqual({ id: "t1", position: 0 });
        expect(rows[1]).toEqual({ id: "t2", position: 1 });
        expect(rows[2]).toEqual({ id: "t3", position: 2 });
      });
    });

    describe("when replacing existing tracks", () => {
      it("should delete old tracks and insert new ones", async () => {
        await Playlist.replaceAll(sessionId, [makeTrack({ id: "old-1" })]);
        await Playlist.replaceAll(sessionId, [
          makeTrack({ id: "new-1" }),
          makeTrack({ id: "new-2" }),
        ]);

        const rows = rawDb
          .prepare("SELECT id FROM playlist_tracks WHERE playlist_id = ?")
          .all(sessionId) as Array<{ id: string }>;
        expect(rows).toHaveLength(2);
        expect(rows.map((r) => r.id)).toContain("new-1");
        expect(rows.map((r) => r.id)).not.toContain("old-1");
      });
    });
  });

  describe("updateVideo", () => {
    beforeEach(async () => {
      await Playlist.replaceAll(sessionId, [makeTrack({ id: "uv-1", track_name: "Battle Theme" })]);
    });

    describe("when updating video info on a track", () => {
      it("should set video fields", async () => {
        await Playlist.updateVideo(
          "uv-1",
          "vid-123",
          "Video Title",
          "Channel",
          "thumb.jpg",
          180,
          "Clean Name",
        );
        const row = rawDb
          .prepare(
            "SELECT video_id, video_title, channel_title, thumbnail, duration_seconds, track_name FROM playlist_tracks WHERE id = ?",
          )
          .get("uv-1") as {
          video_id: string;
          video_title: string;
          channel_title: string;
          thumbnail: string;
          duration_seconds: number;
          track_name: string;
        };
        expect(row.video_id).toBe("vid-123");
        expect(row.video_title).toBe("Video Title");
        expect(row.channel_title).toBe("Channel");
        expect(row.thumbnail).toBe("thumb.jpg");
        expect(row.duration_seconds).toBe(180);
        expect(row.track_name).toBe("Clean Name");
      });
    });
  });

  describe("removeOne", () => {
    describe("when removing a single track", () => {
      it("should delete only that track", async () => {
        await Playlist.replaceAll(sessionId, [
          makeTrack({ id: "keep" }),
          makeTrack({ id: "remove" }),
        ]);
        await Playlist.removeOne("remove");

        const rows = rawDb
          .prepare("SELECT id FROM playlist_tracks WHERE playlist_id = ?")
          .all(sessionId) as Array<{ id: string }>;
        expect(rows).toHaveLength(1);
        expect(rows[0].id).toBe("keep");
      });
    });
  });

  describe("reorder", () => {
    describe("when reordering tracks", () => {
      it("should update position fields correctly", async () => {
        await Playlist.replaceAll(sessionId, [
          makeTrack({ id: "r1" }),
          makeTrack({ id: "r2" }),
          makeTrack({ id: "r3" }),
        ]);

        // Reverse the order
        await Playlist.reorder(["r3", "r1", "r2"]);

        const rows = rawDb
          .prepare(
            "SELECT id, position FROM playlist_tracks WHERE playlist_id = ? ORDER BY position",
          )
          .all(sessionId) as Array<{ id: string; position: number }>;
        expect(rows[0]).toEqual({ id: "r3", position: 0 });
        expect(rows[1]).toEqual({ id: "r1", position: 1 });
        expect(rows[2]).toEqual({ id: "r2", position: 2 });
      });
    });
  });

  describe("listUnsyncedFound", () => {
    describe("when unsynced tracks with video_id exist", () => {
      it("should return only tracks with video_id and no synced_at", async () => {
        await Playlist.replaceAll(sessionId, [
          makeTrack({ id: "uf1", video_id: "v1" }),
          makeTrack({ id: "uf2", video_id: null }),
          makeTrack({ id: "uf3", video_id: "v2" }),
        ]);
        // Sync one of them
        await Playlist.markSynced("uf1");

        const unsynced = await Playlist.listUnsyncedFound(userId);
        expect(unsynced).toHaveLength(1);
        expect(unsynced[0].id).toBe("uf3");
        expect(unsynced[0].video_id).toBe("v2");
      });
    });

    describe("when tracks have no video_id", () => {
      it("should not include them", async () => {
        await Playlist.replaceAll(sessionId, [makeTrack({ id: "nv1", video_id: null })]);

        const unsynced = await Playlist.listUnsyncedFound(userId);
        expect(unsynced).toHaveLength(0);
      });
    });
  });

  describe("countSynced", () => {
    describe("when some tracks are synced", () => {
      it("should return the count of synced tracks", async () => {
        await Playlist.replaceAll(sessionId, [
          makeTrack({ id: "cs1", video_id: "v1" }),
          makeTrack({ id: "cs2", video_id: "v2" }),
          makeTrack({ id: "cs3", video_id: "v3" }),
        ]);
        await Playlist.markSynced("cs1");
        await Playlist.markSynced("cs2");

        expect(await Playlist.countSynced(userId)).toBe(2);
      });
    });

    describe("when no tracks are synced", () => {
      it("should return 0", async () => {
        await Playlist.replaceAll(sessionId, [makeTrack({ id: "ns1", video_id: "v1" })]);
        expect(await Playlist.countSynced(userId)).toBe(0);
      });
    });
  });

  describe("getById", () => {
    describe("when track exists", () => {
      it("should return the track with game_title", async () => {
        await Playlist.replaceAll(sessionId, [makeTrack({ id: "gb1", track_name: "Theme" })]);
        const track = await Playlist.getById("gb1");
        expect(track).toBeDefined();
        expect(track!.id).toBe("gb1");
        expect(track!.game_title).toBe("Test Game");
      });
    });

    describe("when track does not exist", () => {
      it("should return undefined", async () => {
        expect(await Playlist.getById("nonexistent")).toBeUndefined();
      });
    });
  });

  describe("clearAll", () => {
    describe("when clearing tracks from active session", () => {
      it("should delete all tracks from the active session", async () => {
        await Playlist.replaceAll(sessionId, [makeTrack({ id: "cl1" }), makeTrack({ id: "cl2" })]);
        await Playlist.clearAll(userId);

        const rows = rawDb
          .prepare("SELECT * FROM playlist_tracks WHERE playlist_id = ?")
          .all(sessionId);
        expect(rows).toHaveLength(0);
      });

      it("should not delete tracks from other sessions", async () => {
        // Make sessionId (from beforeEach) the older session
        rawDb
          .prepare("UPDATE playlists SET created_at = '2024-01-01T00:00:00Z' WHERE id = ?")
          .run(sessionId);
        // Create a newer session that becomes the active one
        const otherSession = seedTestSession(rawDb, userId, { id: "other-session", name: "Other" });
        rawDb
          .prepare("UPDATE playlists SET created_at = '2024-01-02T00:00:00Z' WHERE id = ?")
          .run(otherSession);

        // Insert tracks into the older (non-active) session
        rawDb
          .prepare(
            "INSERT INTO playlist_tracks (id, playlist_id, game_id, position) VALUES (?, ?, ?, ?)",
          )
          .run("keep-track", sessionId, gameId, 0);

        await Playlist.replaceAll(otherSession, [makeTrack({ id: "active-track" })]);
        await Playlist.clearAll(userId);

        // The older session's track should remain
        const kept = rawDb
          .prepare("SELECT * FROM playlist_tracks WHERE playlist_id = ?")
          .all(sessionId);
        expect(kept).toHaveLength(1);
      });
    });
  });

  describe("listAllWithGameTitle", () => {
    describe("when fetching by session ID", () => {
      it("should return tracks ordered by position with game_title", async () => {
        await Playlist.replaceAll(sessionId, [
          makeTrack({ id: "la1", track_name: "First" }),
          makeTrack({ id: "la2", track_name: "Second" }),
        ]);

        const tracks = await Playlist.listAllWithGameTitle(userId, sessionId);
        expect(tracks).toHaveLength(2);
        expect(tracks[0].track_name).toBe("First");
        expect(tracks[0].game_title).toBe("Test Game");
        expect(tracks[0].position).toBe(0);
        expect(tracks[1].position).toBe(1);
      });
    });

    describe("when fetching active session tracks", () => {
      it("should use the active session subquery", async () => {
        await Playlist.replaceAll(sessionId, [makeTrack({ id: "as1", track_name: "Active" })]);

        const tracks = await Playlist.listAllWithGameTitle(userId);
        expect(tracks).toHaveLength(1);
        expect(tracks[0].track_name).toBe("Active");
      });
    });
  });

  describe("getVideoIdsForSession", () => {
    describe("when session has tracks with video IDs", () => {
      it("should return all non-null video IDs", async () => {
        await Playlist.replaceAll(sessionId, [
          makeTrack({ id: "vs1", video_id: "vid-a" }),
          makeTrack({ id: "vs2", video_id: "vid-b" }),
          makeTrack({ id: "vs3", video_id: null }),
        ]);

        const ids = await Playlist.getVideoIdsForSession(sessionId);
        expect(ids).toHaveLength(2);
        expect(ids).toContain("vid-a");
        expect(ids).toContain("vid-b");
      });
    });

    describe("when session has no tracks", () => {
      it("should return empty array", async () => {
        const ids = await Playlist.getVideoIdsForSession(sessionId);
        expect(ids).toHaveLength(0);
      });
    });

    describe("when other sessions have tracks", () => {
      it("should only return video IDs from the specified session", async () => {
        const otherSession = seedTestSession(rawDb, userId, { id: "other-s", name: "Other" });
        await Playlist.replaceAll(sessionId, [makeTrack({ id: "vs4", video_id: "vid-mine" })]);
        await Playlist.replaceAll(otherSession, [makeTrack({ id: "vs5", video_id: "vid-other" })]);

        const ids = await Playlist.getVideoIdsForSession(sessionId);
        expect(ids).toEqual(["vid-mine"]);
      });
    });
  });

  describe("updateVideo", () => {
    describe("when updating a track's video", () => {
      it("should replace video fields", async () => {
        await Playlist.replaceAll(sessionId, [
          makeTrack({ id: "uv1", video_id: "old-vid", video_title: "Old Title" }),
        ]);

        await Playlist.updateVideo(
          "uv1",
          "new-vid",
          "New Title",
          "Channel",
          "thumb.jpg",
          240,
          "New Track",
        );

        const updated = await Playlist.getById("uv1");
        expect(updated).toBeDefined();
        expect(updated!.video_id).toBe("new-vid");
        expect(updated!.video_title).toBe("New Title");
        expect(updated!.channel_title).toBe("Channel");
        expect(updated!.thumbnail).toBe("thumb.jpg");
        expect(updated!.duration_seconds).toBe(240);
        expect(updated!.track_name).toBe("New Track");
      });
    });

    describe("when channel and thumbnail are null", () => {
      it("should accept null values", async () => {
        await Playlist.replaceAll(sessionId, [
          makeTrack({ id: "uv2", video_id: "old-vid", channel_title: "Ch", thumbnail: "t.jpg" }),
        ]);

        await Playlist.updateVideo("uv2", "new-vid", "Title", null, null, 180);

        const updated = await Playlist.getById("uv2");
        expect(updated!.channel_title).toBeNull();
        expect(updated!.thumbnail).toBeNull();
      });
    });
  });
});
