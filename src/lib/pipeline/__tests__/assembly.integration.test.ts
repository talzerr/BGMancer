import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import {
  createTestDrizzleDB,
  seedTestUser,
  seedTestGame,
  seedTestSession,
} from "@/lib/db/test-helpers";
import { TEST_USER_ID } from "@/test/constants";
import { TrackStatus } from "@/types";
import type { PlaylistTrack } from "@/types";
import { MIN_TRACK_DURATION_SECONDS, MAX_TRACK_DURATION_SECONDS } from "@/lib/constants";

let db: DrizzleDB;
let rawDb: Database.Database;

vi.mock("@/lib/db", async () => {
  const { MOCK_LOCAL_USER_ID, MOCK_LOCAL_LIBRARY_ID } = await import("@/test/constants");
  return {
    getDB: () => db,

    LOCAL_USER_ID: MOCK_LOCAL_USER_ID,
    LOCAL_LIBRARY_ID: MOCK_LOCAL_LIBRARY_ID,
  };
});

const mockFindBestVideo = vi.fn();

vi.mock("@/lib/services/youtube", async () => {
  const original = await vi.importActual("@/lib/services/youtube");
  return {
    ...original,
    findBestVideo: (...args: unknown[]) => mockFindBestVideo(...args),
  };
});

const { resolvePendingSlots } = await import("../assembly");
const { Playlist } = await import("@/lib/db/repo");

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seedTestUser(rawDb);
  mockFindBestVideo.mockReset();
});

function makePendingPlaylistTrack(id: string, gameId: string, queries: string[]): PlaylistTrack {
  return {
    id,
    playlist_id: "pl1",
    game_id: gameId,
    game_title: "Test Game",
    track_name: null,
    video_id: null,
    video_title: null,
    channel_title: null,
    thumbnail: null,
    search_queries: queries,
    duration_seconds: null,
    position: 0,
    status: TrackStatus.Pending,
    error_message: null,
    created_at: "",
    synced_at: null,
  };
}

describe("resolvePendingSlots", () => {
  let gameId: string;
  let sessionId: string;

  beforeEach(async () => {
    gameId = seedTestGame(rawDb, TEST_USER_ID, { id: "g1" });
    sessionId = seedTestSession(rawDb, TEST_USER_ID, { id: "pl1" });
    // Insert a pending track into the DB
    await Playlist.replaceAll(sessionId, [
      {
        id: "t1",
        game_id: gameId,
        track_name: null,
        video_id: null,
        video_title: null,
        channel_title: null,
        thumbnail: null,
        search_queries: ["test query"],
        duration_seconds: null,
        status: TrackStatus.Pending,
        error_message: null,
      },
    ]);
  });

  describe("when findBestVideo returns a valid result", () => {
    beforeEach(() => {
      mockFindBestVideo.mockResolvedValue({
        videoId: "vid-found",
        title: "Found Video",
        channelTitle: "Channel",
        thumbnail: "https://thumb.jpg",
        durationSeconds: 200,
        description: "",
      });
    });

    it("should update the track to Found status in DB", async () => {
      const inserted = [makePendingPlaylistTrack("t1", gameId, ["test query"])];
      await resolvePendingSlots(inserted);

      const dbTrack = await Playlist.getById("t1");
      expect(dbTrack?.status).toBe(TrackStatus.Found);
      expect(dbTrack?.video_id).toBe("vid-found");
    });

    it("should mutate the in-memory array", async () => {
      const inserted = [makePendingPlaylistTrack("t1", gameId, ["test query"])];
      await resolvePendingSlots(inserted);

      expect(inserted[0].status).toBe(TrackStatus.Found);
      expect(inserted[0].video_id).toBe("vid-found");
    });
  });

  describe("when findBestVideo returns null", () => {
    beforeEach(() => {
      mockFindBestVideo.mockResolvedValue(null);
    });

    it("should set error status on the track", async () => {
      const inserted = [makePendingPlaylistTrack("t1", gameId, ["test query"])];
      await resolvePendingSlots(inserted);

      const dbTrack = await Playlist.getById("t1");
      expect(dbTrack?.status).toBe(TrackStatus.Error);
      expect(dbTrack?.error_message).toContain("No suitable");
    });
  });

  describe("when the video is too short and allowShortTracks is false", () => {
    beforeEach(() => {
      mockFindBestVideo.mockResolvedValue({
        videoId: "vid-short",
        title: "Short",
        channelTitle: "C",
        thumbnail: "t.jpg",
        durationSeconds: MIN_TRACK_DURATION_SECONDS - 1,
        description: "",
      });
    });

    it("should set error for short tracks", async () => {
      const inserted = [makePendingPlaylistTrack("t1", gameId, ["q"])];
      await resolvePendingSlots(inserted, false, false);

      const dbTrack = await Playlist.getById("t1");
      expect(dbTrack?.status).toBe(TrackStatus.Error);
      expect(dbTrack?.error_message).toContain("too short");
    });
  });

  describe("when the video is too long and allowLongTracks is false", () => {
    beforeEach(() => {
      mockFindBestVideo.mockResolvedValue({
        videoId: "vid-long",
        title: "Long",
        channelTitle: "C",
        thumbnail: "t.jpg",
        durationSeconds: MAX_TRACK_DURATION_SECONDS + 1,
        description: "",
      });
    });

    it("should set error for long tracks", async () => {
      const inserted = [makePendingPlaylistTrack("t1", gameId, ["q"])];
      await resolvePendingSlots(inserted, false, false);

      const dbTrack = await Playlist.getById("t1");
      expect(dbTrack?.status).toBe(TrackStatus.Error);
      expect(dbTrack?.error_message).toContain("exceeds maximum");
    });
  });

  describe("when findBestVideo throws a YouTubeQuotaError", () => {
    it("should propagate the error", async () => {
      const { YouTubeQuotaError } = await import("@/lib/services/youtube");
      mockFindBestVideo.mockRejectedValue(new YouTubeQuotaError());

      const inserted = [makePendingPlaylistTrack("t1", gameId, ["q"])];
      await expect(resolvePendingSlots(inserted)).rejects.toThrow(YouTubeQuotaError);
    });
  });

  describe("when findBestVideo throws a non-quota error", () => {
    beforeEach(() => {
      mockFindBestVideo.mockRejectedValue(new Error("Network error"));
    });

    it("should leave the track as pending", async () => {
      const inserted = [makePendingPlaylistTrack("t1", gameId, ["q"])];
      await resolvePendingSlots(inserted);

      const dbTrack = await Playlist.getById("t1");
      expect(dbTrack?.status).toBe(TrackStatus.Pending);
    });
  });

  describe("when track has no search_queries", () => {
    it("should skip it", async () => {
      const inserted = [makePendingPlaylistTrack("t1", gameId, [])];
      inserted[0].search_queries = null;
      await resolvePendingSlots(inserted);

      expect(mockFindBestVideo).not.toHaveBeenCalled();
    });
  });

  describe("when track is not pending", () => {
    it("should skip it", async () => {
      const track = makePendingPlaylistTrack("t1", gameId, ["q"]);
      track.status = TrackStatus.Found;
      await resolvePendingSlots([track]);

      expect(mockFindBestVideo).not.toHaveBeenCalled();
    });
  });
});
