import { describe, it, expect } from "vitest";
import { cn, gameSlug, idFromGameSlug } from "../utils";

describe("cn", () => {
  it("should merge class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("should resolve Tailwind conflicts (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("should handle conditional classes", () => {
    expect(cn("base", false && "hidden", "extra")).toBe("base extra");
  });
});

describe("gameSlug", () => {
  describe("when given a normal title and id", () => {
    it("should produce a lowercase hyphenated slug with id suffix", () => {
      expect(gameSlug("Elden Ring", "019d1a36-abc")).toBe("elden-ring--019d1a36-abc");
    });
  });

  describe("when the title contains special characters", () => {
    it("should strip non-alphanumeric characters", () => {
      expect(gameSlug("Dark Souls III: The Ringed City", "id-1")).toBe(
        "dark-souls-iii-the-ringed-city--id-1",
      );
    });
  });

  describe("when the title has leading or trailing special characters", () => {
    it("should strip leading and trailing hyphens", () => {
      expect(gameSlug("---Hello World---", "id-1")).toBe("hello-world--id-1");
    });
  });

  describe("when the title is already lowercase", () => {
    it("should produce the same slug", () => {
      expect(gameSlug("hollow knight", "id-2")).toBe("hollow-knight--id-2");
    });
  });
});

describe("idFromGameSlug", () => {
  describe("when given a slug with a -- separator", () => {
    it("should extract the id part", () => {
      expect(idFromGameSlug("elden-ring--019d1a36-abc")).toBe("019d1a36-abc");
    });
  });

  describe("when the slug has no -- separator", () => {
    it("should return the entire string", () => {
      expect(idFromGameSlug("plain-id")).toBe("plain-id");
    });
  });

  describe("when the slug has multiple -- separators", () => {
    it("should return the part after the last --", () => {
      expect(idFromGameSlug("a--b--c")).toBe("c");
    });
  });
});
