import { describe, it, expect } from "vitest";
import { parseTracklist } from "../track-parser";

describe("parseTracklist", () => {
  describe("when given plain track names", () => {
    it("should parse one track per line with sequential positions", () => {
      const result = parseTracklist("A Premonition\nChrono Trigger\nMorning Sunlight");
      expect(result).toEqual([
        { name: "A Premonition", position: 1, durationSeconds: null },
        { name: "Chrono Trigger", position: 2, durationSeconds: null },
        { name: "Morning Sunlight", position: 3, durationSeconds: null },
      ]);
    });
  });

  describe("when given numbered tracks with durations", () => {
    it("should strip numbers and extract M:SS durations", () => {
      const result = parseTracklist("01. A Premonition 0:35\n02. Chrono Trigger 2:27");
      expect(result).toEqual([
        { name: "A Premonition", position: 1, durationSeconds: 35 },
        { name: "Chrono Trigger", position: 2, durationSeconds: 147 },
      ]);
    });
  });

  describe("when given dash-separated numbering", () => {
    it("should strip '1 - ' style prefixes", () => {
      const result = parseTracklist("1 - A Premonition\n2 - Chrono Trigger");
      expect(result).toEqual([
        { name: "A Premonition", position: 1, durationSeconds: null },
        { name: "Chrono Trigger", position: 2, durationSeconds: null },
      ]);
    });
  });

  describe("when given parenthesized numbering", () => {
    it("should strip '01) ' style prefixes", () => {
      const result = parseTracklist("01) A Premonition 0:35\n02) Chrono Trigger 2:27");
      expect(result).toEqual([
        { name: "A Premonition", position: 1, durationSeconds: 35 },
        { name: "Chrono Trigger", position: 2, durationSeconds: 147 },
      ]);
    });
  });

  describe("when given H:MM:SS durations", () => {
    it("should parse full hours", () => {
      const result = parseTracklist("Epic Suite 1:23:45");
      expect(result).toEqual([
        { name: "Epic Suite", position: 1, durationSeconds: 3600 + 23 * 60 + 45 },
      ]);
    });
  });

  describe("when given empty lines and whitespace", () => {
    it("should skip blank lines", () => {
      const result = parseTracklist("\n  A Premonition  \n\n  Chrono Trigger  \n\n");
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("A Premonition");
      expect(result[1].name).toBe("Chrono Trigger");
    });
  });

  describe("when given empty string", () => {
    it("should return empty array", () => {
      expect(parseTracklist("")).toEqual([]);
    });
  });

  describe("when duration appears mid-line", () => {
    it("should extract duration and clean up separators", () => {
      const result = parseTracklist("3:15 A Premonition");
      expect(result[0].name).toBe("A Premonition");
      expect(result[0].durationSeconds).toBe(195);
    });
  });

  describe("when given em-dash numbering", () => {
    it("should strip '01 — ' style prefixes", () => {
      const result = parseTracklist("01 — A Premonition");
      expect(result[0].name).toBe("A Premonition");
    });
  });
});
