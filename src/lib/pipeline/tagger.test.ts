import { describe, it, expect } from "vitest";
import { extractTagArray, parseTagItem } from "./tagger";
import type { LLMTagItem } from "./tagger";
import { TrackRole, TrackMood, TrackInstrumentation } from "@/types";

describe("extractTagArray", () => {
  describe("when the response is a clean JSON array", () => {
    it("should parse correctly", () => {
      const raw =
        '[{"index":1,"energy":2,"roles":["opener"],"moods":["epic"],"instrumentation":["orchestral"],"hasVocals":false,"confident":true}]';
      const result = extractTagArray(raw);
      expect(result).toHaveLength(1);
      expect(result[0].index).toBe(1);
      expect(result[0].energy).toBe(2);
    });

    it("should handle multiple items", () => {
      const items = [
        {
          index: 1,
          energy: 1,
          roles: ["ambient"],
          moods: [],
          instrumentation: [],
          hasVocals: false,
          confident: true,
        },
        {
          index: 2,
          energy: 3,
          roles: ["combat"],
          moods: ["epic"],
          instrumentation: ["orchestral"],
          hasVocals: true,
          confident: false,
        },
      ];
      const result = extractTagArray(JSON.stringify(items));
      expect(result).toHaveLength(2);
    });
  });

  describe("when the JSON array is embedded in surrounding text", () => {
    it("should extract from surrounding prose", () => {
      const raw = `Here are the results:
[{"index":1,"energy":1,"roles":["ambient"],"moods":["peaceful"],"instrumentation":["piano"],"hasVocals":false,"confident":true}]
Done tagging.`;
      const result = extractTagArray(raw);
      expect(result).toHaveLength(1);
      expect(result[0].roles).toEqual(["ambient"]);
    });

    it("should extract from markdown code fences", () => {
      const raw =
        "```json\n" +
        '[{"index":1,"energy":3,"roles":["combat"],"moods":["epic"],"instrumentation":["metal"],"hasVocals":false,"confident":true}]\n' +
        "```";
      const result = extractTagArray(raw);
      expect(result).toHaveLength(1);
      expect(result[0].energy).toBe(3);
    });
  });

  describe("when the response is invalid", () => {
    it("should throw when no JSON array is present", () => {
      expect(() => extractTagArray("No JSON here")).toThrow("No JSON array found in response");
    });

    it("should throw on malformed JSON", () => {
      expect(() => extractTagArray("[{broken json")).toThrow();
    });
  });
});

describe("parseTagItem", () => {
  const validItem: LLMTagItem = {
    index: 1,
    energy: 2,
    roles: ["opener", "ambient"],
    moods: ["peaceful", "nostalgic"],
    instrumentation: ["piano", "strings"],
    hasVocals: false,
    confident: true,
  };

  describe("when all fields are valid", () => {
    it("should return all parsed fields", () => {
      const result = parseTagItem(validItem);
      expect(result).not.toBeNull();
      expect(result!.energy).toBe(2);
      expect(result!.roles).toEqual([TrackRole.Opener, TrackRole.Ambient]);
      expect(result!.moods).toEqual([TrackMood.Peaceful, TrackMood.Nostalgic]);
      expect(result!.instrumentation).toEqual([
        TrackInstrumentation.Piano,
        TrackInstrumentation.Strings,
      ]);
      expect(result!.hasVocals).toBe(false);
      expect(result!.confident).toBe(true);
    });
  });

  describe("when energy is valid (1, 2, or 3)", () => {
    it("should accept each valid value", () => {
      expect(parseTagItem({ ...validItem, energy: 1 })!.energy).toBe(1);
      expect(parseTagItem({ ...validItem, energy: 2 })!.energy).toBe(2);
      expect(parseTagItem({ ...validItem, energy: 3 })!.energy).toBe(3);
    });
  });

  describe("when energy is out of range or non-numeric", () => {
    it("should return null", () => {
      expect(parseTagItem({ ...validItem, energy: 0 })).toBeNull();
      expect(parseTagItem({ ...validItem, energy: 4 })).toBeNull();
      expect(parseTagItem({ ...validItem, energy: "high" as unknown as number })).toBeNull();
    });
  });

  describe("when roles contain valid values", () => {
    it("should filter out invalid roles", () => {
      expect(parseTagItem({ ...validItem, roles: ["opener", "invalid_role"] })!.roles).toEqual([
        TrackRole.Opener,
      ]);
    });

    it("should lowercase role values", () => {
      expect(parseTagItem({ ...validItem, roles: ["OPENER", "Combat"] })!.roles).toEqual([
        TrackRole.Opener,
        TrackRole.Combat,
      ]);
    });

    it("should limit to 2 roles", () => {
      expect(
        parseTagItem({ ...validItem, roles: ["opener", "ambient", "combat"] })!.roles,
      ).toHaveLength(2);
    });

    it("should filter out non-string items", () => {
      expect(
        parseTagItem({ ...validItem, roles: [42, "opener"] as unknown as unknown[] })!.roles,
      ).toEqual([TrackRole.Opener]);
    });
  });

  describe("when no valid roles remain after filtering", () => {
    it("should return null for all-invalid roles", () => {
      expect(parseTagItem({ ...validItem, roles: ["bogus", "fake"] })).toBeNull();
    });

    it("should return null for empty roles", () => {
      expect(parseTagItem({ ...validItem, roles: [] })).toBeNull();
    });

    it("should return null when roles is not an array", () => {
      expect(parseTagItem({ ...validItem, roles: "opener" as unknown as unknown[] })).toBeNull();
    });
  });

  describe("when moods contain valid values", () => {
    it("should filter out invalid moods", () => {
      expect(parseTagItem({ ...validItem, moods: ["epic", "fake_mood"] })!.moods).toEqual([
        TrackMood.Epic,
      ]);
    });

    it("should limit to 3 moods", () => {
      expect(
        parseTagItem({ ...validItem, moods: ["epic", "tense", "peaceful", "dark"] })!.moods,
      ).toHaveLength(3);
    });
  });

  describe("when moods are empty or non-array", () => {
    it("should return empty array for all-invalid moods", () => {
      expect(parseTagItem({ ...validItem, moods: ["bogus"] })!.moods).toEqual([]);
    });

    it("should return empty array when moods is not an array", () => {
      expect(parseTagItem({ ...validItem, moods: "epic" as unknown as unknown[] })!.moods).toEqual(
        [],
      );
    });
  });

  describe("when instrumentation contains valid values", () => {
    it("should filter out invalid values", () => {
      expect(
        parseTagItem({ ...validItem, instrumentation: ["piano", "kazoo"] })!.instrumentation,
      ).toEqual([TrackInstrumentation.Piano]);
    });

    it("should limit to 3 values", () => {
      expect(
        parseTagItem({
          ...validItem,
          instrumentation: ["piano", "strings", "orchestral", "synth"],
        })!.instrumentation,
      ).toHaveLength(3);
    });
  });

  describe("when instrumentation is not an array", () => {
    it("should return empty array", () => {
      expect(
        parseTagItem({ ...validItem, instrumentation: "piano" as unknown as unknown[] })!
          .instrumentation,
      ).toEqual([]);
    });
  });

  describe("when coercing hasVocals", () => {
    it("should return true only for boolean true", () => {
      expect(parseTagItem({ ...validItem, hasVocals: true })!.hasVocals).toBe(true);
    });

    it("should return false for boolean false", () => {
      expect(parseTagItem({ ...validItem, hasVocals: false })!.hasVocals).toBe(false);
    });

    it("should return false for truthy non-boolean values", () => {
      expect(parseTagItem({ ...validItem, hasVocals: 1 })!.hasVocals).toBe(false);
      expect(parseTagItem({ ...validItem, hasVocals: "yes" })!.hasVocals).toBe(false);
    });
  });

  describe("when checking the confident flag", () => {
    it("should return true for boolean true", () => {
      expect(parseTagItem({ ...validItem, confident: true })!.confident).toBe(true);
    });

    it("should return false for boolean false", () => {
      expect(parseTagItem({ ...validItem, confident: false })!.confident).toBe(false);
    });

    it("should default to true for undefined", () => {
      expect(parseTagItem({ ...validItem, confident: undefined })!.confident).toBe(true);
    });

    it("should return true for truthy non-boolean", () => {
      expect(parseTagItem({ ...validItem, confident: 1 })!.confident).toBe(true);
    });
  });
});
