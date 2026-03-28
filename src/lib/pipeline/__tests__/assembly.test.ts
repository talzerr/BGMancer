import { describe, it, expect } from "vitest";
import {
  makePendingTrack,
  toInsertable,
  compilationQueries,
  taggedTrackToPending,
} from "../assembly";
import { TrackStatus, TrackRole, TrackMood, TrackInstrumentation } from "@/types";
import type { TaggedTrack } from "@/types";
import { TEST_GAME_ID, TEST_GAME_TITLE, TEST_TRACK_NAME, TEST_VIDEO_ID } from "@/test/constants";

describe("makePendingTrack", () => {
  describe("when called with minimal args", () => {
    it("should create a track with defaults", () => {
      const track = makePendingTrack(TEST_GAME_ID, TEST_GAME_TITLE);
      expect(track.game_id).toBe(TEST_GAME_ID);
      expect(track.game_title).toBe(TEST_GAME_TITLE);
      expect(track.status).toBe(TrackStatus.Pending);
      expect(track.track_name).toBeNull();
      expect(track.video_id).toBeNull();
      expect(track.id).toBeTruthy();
    });
  });

  describe("when called with overrides", () => {
    it("should apply overrides to the defaults", () => {
      const track = makePendingTrack(TEST_GAME_ID, TEST_GAME_TITLE, {
        track_name: TEST_TRACK_NAME,
        status: TrackStatus.Found,
      });
      expect(track.track_name).toBe(TEST_TRACK_NAME);
      expect(track.status).toBe(TrackStatus.Found);
    });
  });

  describe("when called twice", () => {
    it("should generate unique ids", () => {
      const t1 = makePendingTrack(TEST_GAME_ID, "Game");
      const t2 = makePendingTrack(TEST_GAME_ID, "Game");
      expect(t1.id).not.toBe(t2.id);
    });
  });
});

describe("toInsertable", () => {
  describe("when converting pending tracks", () => {
    it("should map fields correctly and exclude non-insertable fields", () => {
      const pending = makePendingTrack(TEST_GAME_ID, "Game", {
        track_name: "Track 1",
        video_id: "vid1",
      });
      const insertable = toInsertable([pending]);
      expect(insertable).toHaveLength(1);
      expect(insertable[0].id).toBe(pending.id);
      expect(insertable[0].game_id).toBe(TEST_GAME_ID);
      expect(insertable[0].track_name).toBe("Track 1");
      expect(insertable[0].video_id).toBe("vid1");
      expect(insertable[0].status).toBe(TrackStatus.Pending);
      // Should not have game_title (not part of InsertableTrack)
      expect("game_title" in insertable[0]).toBe(false);
    });
  });
});

describe("compilationQueries", () => {
  describe("when generating search queries for a game", () => {
    it("should return 3 query strings containing the game title", () => {
      const queries = compilationQueries("Hollow Knight");
      expect(queries).toHaveLength(3);
      for (const q of queries) {
        expect(q).toContain("Hollow Knight");
      }
    });

    it("should include 'OST', 'soundtrack', and 'game soundtrack' variants", () => {
      const queries = compilationQueries("Test");
      expect(queries.some((q) => q.includes("OST"))).toBe(true);
      expect(queries.some((q) => q.includes("soundtrack"))).toBe(true);
    });
  });
});

describe("taggedTrackToPending", () => {
  const tagged: TaggedTrack = {
    videoId: TEST_VIDEO_ID,
    title: "Main Theme",
    gameId: TEST_GAME_ID,
    gameTitle: TEST_GAME_TITLE,
    energy: 2,
    roles: [TrackRole.Opener],
    moods: [TrackMood.Epic],
    instrumentation: [TrackInstrumentation.Orchestral],
    hasVocals: false,
    durationSeconds: 180,
    viewCount: 50000,
  };

  describe("when converting a tagged track", () => {
    it("should set status to Found with video info", () => {
      const pending = taggedTrackToPending(tagged, 180);
      expect(pending.status).toBe(TrackStatus.Found);
      expect(pending.video_id).toBe(TEST_VIDEO_ID);
      expect(pending.video_title).toBe("Main Theme");
      expect(pending.track_name).toBe("Main Theme");
      expect(pending.game_id).toBe(TEST_GAME_ID);
      expect(pending.duration_seconds).toBe(180);
    });
  });

  describe("when duration is null", () => {
    it("should pass null through", () => {
      const pending = taggedTrackToPending(tagged, null);
      expect(pending.duration_seconds).toBeNull();
    });
  });
});
