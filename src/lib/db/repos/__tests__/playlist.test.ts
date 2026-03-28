import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import {
  createTestDB,
  clearStmtCache,
  seedTestUser,
  seedTestGame,
  seedTestSession,
} from "../../test-helpers";
import type { InsertableTrack } from "../playlist";
let db: Database.Database;

vi.mock("@/lib/db", async () => {
  const { MOCK_LOCAL_USER_ID, MOCK_LOCAL_LIBRARY_ID } = await import("@/test/constants");
  return {
    getDB: () => db,
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
    search_queries: null,
    duration_seconds: null,
    status: "pending" as const,
    error_message: null,
    ...overrides,
  };
}

beforeEach(() => {
  db = createTestDB();
  clearStmtCache();
  ({ userId } = seedTestUser(db));
  gameId = seedTestGame(db, userId);
  sessionId = seedTestSession(db, userId);
});

describe("Playlist", () => {
  describe("replaceAll", () => {
    describe("when inserting tracks into an empty session", () => {
      it("should insert tracks with correct positions", () => {
        const tracks = [
          makeTrack({ id: "t1", track_name: "Track A" }),
          makeTrack({ id: "t2", track_name: "Track B" }),
          makeTrack({ id: "t3", track_name: "Track C" }),
        ];
        Playlist.replaceAll(sessionId, tracks);

        const rows = db
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
      it("should delete old tracks and insert new ones", () => {
        Playlist.replaceAll(sessionId, [makeTrack({ id: "old-1" })]);
        Playlist.replaceAll(sessionId, [makeTrack({ id: "new-1" }), makeTrack({ id: "new-2" })]);

        const rows = db
          .prepare("SELECT id FROM playlist_tracks WHERE playlist_id = ?")
          .all(sessionId) as Array<{ id: string }>;
        expect(rows).toHaveLength(2);
        expect(rows.map((r) => r.id)).toContain("new-1");
        expect(rows.map((r) => r.id)).not.toContain("old-1");
      });
    });

    describe("when tracks have search_queries", () => {
      it("should serialize search_queries as JSON", () => {
        Playlist.replaceAll(sessionId, [
          makeTrack({ id: "sq-1", search_queries: ["query1", "query2"] }),
        ]);

        const row = db
          .prepare("SELECT search_queries FROM playlist_tracks WHERE id = ?")
          .get("sq-1") as { search_queries: string };
        expect(JSON.parse(row.search_queries)).toEqual(["query1", "query2"]);
      });
    });
  });

  describe("status state machine", () => {
    beforeEach(() => {
      Playlist.replaceAll(sessionId, [makeTrack({ id: "status-1", track_name: "Battle Theme" })]);
    });

    describe("when transitioning pending -> searching -> found -> synced", () => {
      it("should update status at each step", () => {
        Playlist.setSearching("status-1");
        let row = db.prepare("SELECT status FROM playlist_tracks WHERE id = ?").get("status-1") as {
          status: string;
        };
        expect(row.status).toBe("searching");

        Playlist.setFound(
          "status-1",
          "vid-123",
          "Video Title",
          "Channel",
          "thumb.jpg",
          180,
          "Clean Name",
        );
        row = db
          .prepare("SELECT status, video_id, track_name FROM playlist_tracks WHERE id = ?")
          .get("status-1") as { status: string; video_id: string; track_name: string };
        expect(row.status).toBe("found");
        expect(row.video_id).toBe("vid-123");
        expect(row.track_name).toBe("Clean Name");

        Playlist.markSynced("status-1");
        const synced = db
          .prepare("SELECT synced_at FROM playlist_tracks WHERE id = ?")
          .get("status-1") as { synced_at: string | null };
        expect(synced.synced_at).not.toBeNull();
      });
    });

    describe("when setting error status", () => {
      it("should set status to error and store the message", () => {
        Playlist.setError("status-1", "YouTube API quota exceeded");
        const row = db
          .prepare("SELECT status, error_message FROM playlist_tracks WHERE id = ?")
          .get("status-1") as { status: string; error_message: string };
        expect(row.status).toBe("error");
        expect(row.error_message).toBe("YouTube API quota exceeded");
      });
    });

    describe("when setFound is called", () => {
      it("should clear error_message", () => {
        Playlist.setError("status-1", "Some error");
        Playlist.setFound("status-1", "vid-fix", "Fixed", "Ch", "t.jpg");

        const row = db
          .prepare("SELECT error_message FROM playlist_tracks WHERE id = ?")
          .get("status-1") as { error_message: string | null };
        expect(row.error_message).toBeNull();
      });
    });
  });

  describe("removeOne", () => {
    describe("when removing a single track", () => {
      it("should delete only that track", () => {
        Playlist.replaceAll(sessionId, [makeTrack({ id: "keep" }), makeTrack({ id: "remove" })]);
        Playlist.removeOne("remove");

        const rows = db
          .prepare("SELECT id FROM playlist_tracks WHERE playlist_id = ?")
          .all(sessionId) as Array<{ id: string }>;
        expect(rows).toHaveLength(1);
        expect(rows[0].id).toBe("keep");
      });
    });
  });

  describe("reorder", () => {
    describe("when reordering tracks", () => {
      it("should update position fields correctly", () => {
        Playlist.replaceAll(sessionId, [
          makeTrack({ id: "r1" }),
          makeTrack({ id: "r2" }),
          makeTrack({ id: "r3" }),
        ]);

        // Reverse the order
        Playlist.reorder(["r3", "r1", "r2"]);

        const rows = db
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

  describe("listPending", () => {
    describe("when pending tracks exist", () => {
      it("should return only pending tracks", () => {
        Playlist.replaceAll(sessionId, [
          makeTrack({ id: "p1", status: "pending", search_queries: ["q1"] }),
          makeTrack({ id: "p2", status: "found", video_id: "v1" }),
          makeTrack({ id: "p3", status: "pending", search_queries: ["q2"] }),
        ]);

        const pending = Playlist.listPending(userId);
        expect(pending).toHaveLength(2);
        expect(pending.map((p) => p.id)).toEqual(["p1", "p3"]);
      });
    });

    describe("when no pending tracks exist", () => {
      it("should not return found or error tracks", () => {
        Playlist.replaceAll(sessionId, [
          makeTrack({ id: "f1", status: "found", video_id: "v1" }),
          makeTrack({ id: "e1", status: "error", error_message: "fail" }),
        ]);

        const pending = Playlist.listPending(userId);
        expect(pending).toHaveLength(0);
      });
    });
  });

  describe("listUnsyncedFound", () => {
    describe("when unsynced found tracks exist", () => {
      it("should return only found tracks with video_id and no synced_at", () => {
        Playlist.replaceAll(sessionId, [
          makeTrack({ id: "uf1", status: "found", video_id: "v1" }),
          makeTrack({ id: "uf2", status: "pending" }),
          makeTrack({ id: "uf3", status: "found", video_id: "v2" }),
        ]);
        // Sync one of them
        Playlist.markSynced("uf1");

        const unsynced = Playlist.listUnsyncedFound(userId);
        expect(unsynced).toHaveLength(1);
        expect(unsynced[0].id).toBe("uf3");
        expect(unsynced[0].video_id).toBe("v2");
      });
    });

    describe("when found tracks have no video_id", () => {
      it("should not include them", () => {
        Playlist.replaceAll(sessionId, [makeTrack({ id: "nv1", status: "found", video_id: null })]);

        const unsynced = Playlist.listUnsyncedFound(userId);
        expect(unsynced).toHaveLength(0);
      });
    });
  });

  describe("countSynced", () => {
    describe("when some tracks are synced", () => {
      it("should return the count of synced tracks", () => {
        Playlist.replaceAll(sessionId, [
          makeTrack({ id: "cs1", status: "found", video_id: "v1" }),
          makeTrack({ id: "cs2", status: "found", video_id: "v2" }),
          makeTrack({ id: "cs3", status: "found", video_id: "v3" }),
        ]);
        Playlist.markSynced("cs1");
        Playlist.markSynced("cs2");

        expect(Playlist.countSynced(userId)).toBe(2);
      });
    });

    describe("when no tracks are synced", () => {
      it("should return 0", () => {
        Playlist.replaceAll(sessionId, [makeTrack({ id: "ns1", status: "found", video_id: "v1" })]);
        expect(Playlist.countSynced(userId)).toBe(0);
      });
    });
  });

  describe("getById", () => {
    describe("when track exists", () => {
      it("should return the track with game_title", () => {
        Playlist.replaceAll(sessionId, [makeTrack({ id: "gb1", track_name: "Theme" })]);
        const track = Playlist.getById("gb1");
        expect(track).toBeDefined();
        expect(track!.id).toBe("gb1");
        expect(track!.game_title).toBe("Test Game");
      });
    });

    describe("when track does not exist", () => {
      it("should return undefined", () => {
        expect(Playlist.getById("nonexistent")).toBeUndefined();
      });
    });
  });

  describe("getVideoIdsForGame", () => {
    describe("when tracks have video IDs", () => {
      it("should return all video IDs for the game", () => {
        Playlist.replaceAll(sessionId, [
          makeTrack({ id: "vg1", video_id: "vid-a" }),
          makeTrack({ id: "vg2", video_id: "vid-b" }),
          makeTrack({ id: "vg3", video_id: null }),
        ]);

        const ids = Playlist.getVideoIdsForGame(gameId);
        expect(ids).toHaveLength(2);
        expect(ids).toContain("vid-a");
        expect(ids).toContain("vid-b");
      });
    });
  });

  describe("getRecentTrackNames", () => {
    describe("when found tracks with names exist", () => {
      it("should return track names with game titles", () => {
        Playlist.replaceAll(sessionId, [
          makeTrack({ id: "rn1", track_name: "Overworld", status: "found", video_id: "v1" }),
          makeTrack({ id: "rn2", track_name: "Boss Fight", status: "found", video_id: "v2" }),
          makeTrack({ id: "rn3", track_name: null, status: "found", video_id: "v3" }),
        ]);

        const names = Playlist.getRecentTrackNames(userId, 10);
        expect(names).toHaveLength(2);
        expect(names[0].cleanName).toBe("Overworld");
        expect(names[0].gameTitle).toBe("Test Game");
      });
    });

    describe("when no found tracks exist", () => {
      it("should not return pending tracks", () => {
        Playlist.replaceAll(sessionId, [
          makeTrack({ id: "pn1", track_name: "Pending Track", status: "pending" }),
        ]);

        const names = Playlist.getRecentTrackNames(userId, 10);
        expect(names).toHaveLength(0);
      });
    });
  });

  describe("clearAll", () => {
    describe("when clearing tracks from active session", () => {
      it("should delete all tracks from the active session", () => {
        Playlist.replaceAll(sessionId, [makeTrack({ id: "cl1" }), makeTrack({ id: "cl2" })]);
        Playlist.clearAll(userId);

        const rows = db
          .prepare("SELECT * FROM playlist_tracks WHERE playlist_id = ?")
          .all(sessionId);
        expect(rows).toHaveLength(0);
      });

      it("should not delete tracks from other sessions", () => {
        // Make sessionId (from beforeEach) the older session
        db.prepare("UPDATE playlists SET created_at = '2024-01-01T00:00:00Z' WHERE id = ?").run(
          sessionId,
        );
        // Create a newer session that becomes the active one
        const otherSession = seedTestSession(db, userId, { id: "other-session", name: "Other" });
        db.prepare("UPDATE playlists SET created_at = '2024-01-02T00:00:00Z' WHERE id = ?").run(
          otherSession,
        );

        // Insert tracks into the older (non-active) session
        db.prepare(
          "INSERT INTO playlist_tracks (id, playlist_id, game_id, position, status) VALUES (?, ?, ?, ?, 'pending')",
        ).run("keep-track", sessionId, gameId, 0);

        Playlist.replaceAll(otherSession, [makeTrack({ id: "active-track" })]);
        Playlist.clearAll(userId);

        // The older session's track should remain
        const kept = db
          .prepare("SELECT * FROM playlist_tracks WHERE playlist_id = ?")
          .all(sessionId);
        expect(kept).toHaveLength(1);
      });
    });
  });

  describe("listAllWithGameTitle", () => {
    describe("when fetching by session ID", () => {
      it("should return tracks ordered by position with game_title", () => {
        Playlist.replaceAll(sessionId, [
          makeTrack({ id: "la1", track_name: "First" }),
          makeTrack({ id: "la2", track_name: "Second" }),
        ]);

        const tracks = Playlist.listAllWithGameTitle(userId, sessionId);
        expect(tracks).toHaveLength(2);
        expect(tracks[0].track_name).toBe("First");
        expect(tracks[0].game_title).toBe("Test Game");
        expect(tracks[0].position).toBe(0);
        expect(tracks[1].position).toBe(1);
      });
    });

    describe("when fetching active session tracks", () => {
      it("should use the active session subquery", () => {
        Playlist.replaceAll(sessionId, [makeTrack({ id: "as1", track_name: "Active" })]);

        const tracks = Playlist.listAllWithGameTitle(userId);
        expect(tracks).toHaveLength(1);
        expect(tracks[0].track_name).toBe("Active");
      });
    });
  });
});
