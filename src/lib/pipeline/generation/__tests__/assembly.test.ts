import { describe, it, expect } from "vitest";
import { toInsertable, taggedTrackToPending } from "../assembly";
import { TrackRole, TrackMood, TrackInstrumentation } from "@/types";
import type { TaggedTrack } from "@/types";
import { TEST_GAME_ID, TEST_GAME_TITLE, TEST_VIDEO_ID } from "@/test/constants";

describe("toInsertable", () => {
  describe("when converting pending tracks", () => {
    it("should map fields correctly and exclude non-insertable fields", () => {
      const pending = taggedTrackToPending(
        {
          videoId: TEST_VIDEO_ID,
          title: "Track 1",
          gameId: TEST_GAME_ID,
          gameTitle: TEST_GAME_TITLE,
          energy: 2,
          roles: [TrackRole.Opener],
          moods: [TrackMood.Epic],
          instrumentation: [TrackInstrumentation.Orchestral],
          hasVocals: false,
          durationSeconds: 180,
          viewCount: 50000,
        },
        180,
      );
      const insertable = toInsertable([pending]);
      expect(insertable).toHaveLength(1);
      expect(insertable[0].id).toBe(pending.id);
      expect(insertable[0].game_id).toBe(TEST_GAME_ID);
      expect(insertable[0].track_name).toBe("Track 1");
      expect(insertable[0].video_id).toBe(TEST_VIDEO_ID);
      // Should not have game_title (not part of InsertableTrack)
      expect("game_title" in insertable[0]).toBe(false);
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
    it("should set video info", () => {
      const pending = taggedTrackToPending(tagged, 180);
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
