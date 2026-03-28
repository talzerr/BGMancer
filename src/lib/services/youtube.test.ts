import { describe, it, expect } from "vitest";
import { parseDuration, isRejected } from "./youtube";

describe("parseDuration", () => {
  describe("when given a complete HMS duration string", () => {
    it("should return the total seconds", () => {
      expect(parseDuration("PT1H23M45S")).toBe(3600 + 23 * 60 + 45);
    });

    it("should handle large values", () => {
      expect(parseDuration("PT99H59M59S")).toBe(99 * 3600 + 59 * 60 + 59);
    });
  });

  describe("when given a partial duration string", () => {
    it("should parse hours only", () => {
      expect(parseDuration("PT2H")).toBe(7200);
    });

    it("should parse minutes only", () => {
      expect(parseDuration("PT10M")).toBe(600);
    });

    it("should parse seconds only", () => {
      expect(parseDuration("PT45S")).toBe(45);
    });

    it("should parse minutes and seconds without hours", () => {
      expect(parseDuration("PT5M30S")).toBe(330);
    });

    it("should parse hours and seconds without minutes", () => {
      expect(parseDuration("PT1H30S")).toBe(3630);
    });
  });

  describe("when given an invalid or empty string", () => {
    it("should return 0 for a day-only format", () => {
      expect(parseDuration("P1D")).toBe(0);
    });

    it("should return 0 for an empty string", () => {
      expect(parseDuration("")).toBe(0);
    });

    it("should return 0 for PT0S", () => {
      expect(parseDuration("PT0S")).toBe(0);
    });
  });
});

describe("isRejected", () => {
  describe("when no reject keywords are present", () => {
    it("should return false for a clean OST title", () => {
      expect(isRejected("Dark Souls III OST", "official soundtrack")).toBe(false);
    });

    it("should return false for empty inputs", () => {
      expect(isRejected("", "")).toBe(false);
    });
  });

  describe("when a keyword appears in the title", () => {
    it("should reject", () => {
      expect(isRejected("Skyrim Piano Cover", "")).toBe(true);
    });

    it("should be case insensitive", () => {
      expect(isRejected("JAZZ Remix", "")).toBe(true);
    });
  });

  describe("when a keyword appears only in the description", () => {
    it("should reject", () => {
      expect(isRejected("Elden Ring OST", "arranged by a fan")).toBe(true);
    });
  });

  describe("when multi-word or hyphenated keywords are used", () => {
    it("should reject 'fan made'", () => {
      expect(isRejected("fan made compilation", "")).toBe(true);
    });

    it("should reject 'lo-fi'", () => {
      expect(isRejected("lo-fi beats", "")).toBe(true);
    });

    it("should reject 'lofi'", () => {
      expect(isRejected("lofi study music", "")).toBe(true);
    });

    it("should reject 'orchestral remix'", () => {
      expect(isRejected("orchestral remix of battle theme", "")).toBe(true);
    });
  });

  describe("when checking all keywords exhaustively", () => {
    it("should reject every defined keyword", () => {
      const keywords = [
        "cover",
        "covers",
        "reaction",
        "reactions",
        "review",
        "reviews",
        "piano",
        "jazz",
        "remix",
        "remixes",
        "fan-made",
        "fan made",
        "arrangement",
        "arranged",
        "lofi",
        "lo-fi",
        "orchestral remix",
      ];
      for (const kw of keywords) {
        expect(isRejected(`OST ${kw} compilation`, "")).toBe(true);
      }
    });
  });
});
