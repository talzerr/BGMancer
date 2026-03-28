import { describe, it, expect, vi } from "vitest";
import { generateRubric } from "../vibe-profiler";
import type { LLMProvider } from "@/lib/llm/provider";
import { TrackMood, TrackInstrumentation, TrackRole } from "@/types";
import { TEST_GAME_TITLE } from "@/test/constants";

function mockProvider(response: string): LLMProvider {
  return {
    complete: vi.fn().mockResolvedValue(response),
  };
}

function failingProvider(error: Error): LLMProvider {
  return {
    complete: vi.fn().mockRejectedValue(error),
  };
}

describe("generateRubric", () => {
  describe("when game titles list is empty", () => {
    it("should return null without calling the provider", async () => {
      const provider = mockProvider("");
      const result = await generateRubric({ gameTitles: [] }, provider);
      expect(result).toBeNull();
      expect(provider.complete).not.toHaveBeenCalled();
    });
  });

  describe("when the LLM returns a valid rubric", () => {
    it("should parse all fields correctly", async () => {
      const rubricJson = JSON.stringify({
        targetEnergy: [1, 2],
        preferredMoods: [TrackMood.Epic, TrackMood.Mysterious, TrackMood.Tense],
        penalizedMoods: [TrackMood.Playful],
        preferredInstrumentation: [TrackInstrumentation.Orchestral, TrackInstrumentation.Strings],
        penalizedInstrumentation: [TrackInstrumentation.Chiptune],
        allowVocals: false,
        preferredRoles: [TrackRole.Combat, TrackRole.Cinematic],
      });
      const provider = mockProvider(rubricJson);
      const result = await generateRubric({ gameTitles: [TEST_GAME_TITLE] }, provider);

      expect(result).not.toBeNull();
      expect(result!.targetEnergy).toEqual([1, 2]);
      expect(result!.preferredMoods).toContain(TrackMood.Epic);
      expect(result!.penalizedMoods).toContain(TrackMood.Playful);
      expect(result!.preferredInstrumentation).toContain(TrackInstrumentation.Orchestral);
      expect(result!.allowVocals).toBe(false);
      expect(result!.preferredRoles).toContain(TrackRole.Combat);
    });
  });

  describe("when the LLM response is wrapped in prose", () => {
    it("should extract the JSON object", async () => {
      const response = `Here's the rubric:\n${JSON.stringify({
        targetEnergy: [2],
        preferredMoods: [TrackMood.Peaceful],
        penalizedMoods: [],
        preferredInstrumentation: [],
        penalizedInstrumentation: [],
        allowVocals: null,
        preferredRoles: [],
      })}\nDone!`;
      const provider = mockProvider(response);
      const result = await generateRubric({ gameTitles: ["Stardew Valley"] }, provider);
      expect(result).not.toBeNull();
      expect(result!.preferredMoods).toContain(TrackMood.Peaceful);
    });
  });

  describe("when the LLM returns no JSON object", () => {
    it("should return null", async () => {
      const provider = mockProvider("I cannot produce a rubric for that.");
      const result = await generateRubric({ gameTitles: ["Test"] }, provider);
      expect(result).toBeNull();
    });
  });

  describe("when the LLM returns malformed JSON", () => {
    it("should return null", async () => {
      const provider = mockProvider("{broken json here}}}");
      const result = await generateRubric({ gameTitles: ["Test"] }, provider);
      expect(result).toBeNull();
    });
  });

  describe("when the LLM call throws an error", () => {
    it("should return null", async () => {
      const provider = failingProvider(new Error("API timeout"));
      const result = await generateRubric({ gameTitles: ["Test"] }, provider);
      expect(result).toBeNull();
    });
  });

  describe("when preferredMoods are all invalid", () => {
    it("should return null (moods are required)", async () => {
      const provider = mockProvider(
        JSON.stringify({
          targetEnergy: [2],
          preferredMoods: ["invalid_mood"],
          penalizedMoods: [],
          preferredInstrumentation: [],
          penalizedInstrumentation: [],
          allowVocals: null,
          preferredRoles: [],
        }),
      );
      const result = await generateRubric({ gameTitles: ["Test"] }, provider);
      expect(result).toBeNull();
    });
  });

  describe("when targetEnergy contains invalid values", () => {
    it("should filter out non-1/2/3 values", async () => {
      const provider = mockProvider(
        JSON.stringify({
          targetEnergy: [0, 1, 4, 2, "high"],
          preferredMoods: [TrackMood.Epic],
          penalizedMoods: [],
          preferredInstrumentation: [],
          penalizedInstrumentation: [],
          allowVocals: null,
          preferredRoles: [],
        }),
      );
      const result = await generateRubric({ gameTitles: ["Test"] }, provider);
      expect(result!.targetEnergy).toEqual([1, 2]);
    });
  });

  describe("when allowVocals is a non-boolean value", () => {
    it("should default to null", async () => {
      const provider = mockProvider(
        JSON.stringify({
          targetEnergy: [2],
          preferredMoods: [TrackMood.Epic],
          penalizedMoods: [],
          preferredInstrumentation: [],
          penalizedInstrumentation: [],
          allowVocals: "maybe",
          preferredRoles: [],
        }),
      );
      const result = await generateRubric({ gameTitles: ["Test"] }, provider);
      expect(result!.allowVocals).toBeNull();
    });
  });

  describe("when arrays exceed max limits", () => {
    it("should truncate to allowed maximums", async () => {
      const provider = mockProvider(
        JSON.stringify({
          targetEnergy: [1, 2, 3, 1],
          preferredMoods: [
            TrackMood.Epic,
            TrackMood.Tense,
            TrackMood.Peaceful,
            TrackMood.Dark,
            TrackMood.Heroic,
            TrackMood.Mysterious,
          ],
          penalizedMoods: [
            TrackMood.Playful,
            TrackMood.Whimsical,
            TrackMood.Chaotic,
            TrackMood.Serene,
          ],
          preferredInstrumentation: [
            TrackInstrumentation.Orchestral,
            TrackInstrumentation.Strings,
            TrackInstrumentation.Piano,
            TrackInstrumentation.Choir,
            TrackInstrumentation.Brass,
            TrackInstrumentation.Synth,
          ],
          penalizedInstrumentation: [
            TrackInstrumentation.Chiptune,
            TrackInstrumentation.Electronic,
            TrackInstrumentation.Jazz,
            TrackInstrumentation.Folk,
          ],
          allowVocals: true,
          preferredRoles: [
            TrackRole.Combat,
            TrackRole.Cinematic,
            TrackRole.Build,
            TrackRole.Opener,
          ],
        }),
      );
      const result = await generateRubric({ gameTitles: ["Test"] }, provider);
      expect(result!.targetEnergy).toHaveLength(3);
      expect(result!.preferredMoods).toHaveLength(5);
      expect(result!.penalizedMoods).toHaveLength(3);
      expect(result!.preferredInstrumentation).toHaveLength(5);
      expect(result!.penalizedInstrumentation).toHaveLength(3);
      expect(result!.preferredRoles).toHaveLength(3);
    });
  });
});
