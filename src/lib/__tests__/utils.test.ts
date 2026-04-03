import { describe, it, expect } from "vitest";
import { cn, gameSlug, idFromGameSlug, sanitizeGameTitle } from "../utils";
import { GAME_TITLE_MAX_LENGTH } from "@/lib/constants";

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

describe("sanitizeGameTitle", () => {
  it("should strip trademark symbol", () => {
    expect(sanitizeGameTitle("Elden Ring\u2122")).toBe("Elden Ring");
  });

  it("should strip registered symbol", () => {
    expect(sanitizeGameTitle("PlayStation\u00AE")).toBe("PlayStation");
  });

  it("should strip copyright symbol", () => {
    expect(sanitizeGameTitle("\u00A92024 Game")).toBe("2024 Game");
  });

  it("should strip service mark symbol", () => {
    expect(sanitizeGameTitle("Brand\u2120 Game")).toBe("Brand Game");
  });

  it("should strip multiple symbols at once", () => {
    expect(sanitizeGameTitle("Game\u2122 \u00AE Edition\u00A9")).toBe("Game Edition");
  });

  it("should collapse whitespace left by stripped symbols", () => {
    expect(sanitizeGameTitle("A \u2122 B")).toBe("A B");
  });

  it("should trim leading and trailing whitespace", () => {
    expect(sanitizeGameTitle("  Game  ")).toBe("Game");
  });

  it("should enforce max length", () => {
    const long = "A".repeat(GAME_TITLE_MAX_LENGTH + 100);
    expect(sanitizeGameTitle(long)).toHaveLength(GAME_TITLE_MAX_LENGTH);
  });

  it("should preserve clean titles unchanged", () => {
    expect(sanitizeGameTitle("Hollow Knight")).toBe("Hollow Knight");
  });

  it("should NFKC-normalize full-width characters", () => {
    expect(sanitizeGameTitle("\uFF30\uFF4F\uFF4B\u00E9\uFF4D\uFF4F\uFF4E")).toBe("Pok\u00E9mon");
  });

  it("should normalize full-width colons to ASCII", () => {
    expect(sanitizeGameTitle("NieR\uFF1AAutomata")).toBe("NieR:Automata");
  });

  it("should preserve accented characters", () => {
    expect(sanitizeGameTitle("Pok\u00E9mon")).toBe("Pok\u00E9mon");
  });

  it("should preserve CJK characters", () => {
    expect(sanitizeGameTitle("\u30BC\u30CE\u30D6\u30EC\u30A4\u30C9\uFF12")).toBe(
      "\u30BC\u30CE\u30D6\u30EC\u30A4\u30C9\uFF12".normalize("NFKC"),
    );
  });

  it("should preserve catalog-safe punctuation", () => {
    expect(sanitizeGameTitle("S.T.A.L.K.E.R.: Call of Pripyat")).toBe(
      "S.T.A.L.K.E.R.: Call of Pripyat",
    );
    expect(sanitizeGameTitle(".hack//G.U.")).toBe(".hack//G.U.");
    expect(sanitizeGameTitle("Ratchet & Clank")).toBe("Ratchet & Clank");
    expect(sanitizeGameTitle("Assassin's Creed")).toBe("Assassin's Creed");
  });

  it("should preserve Japanese middle dot", () => {
    expect(
      sanitizeGameTitle("\u30C9\u30E9\u30B4\u30F3\u30AF\u30A8\u30B9\u30C8\u30FB\u30C0\u30A4"),
    ).toBe("\u30C9\u30E9\u30B4\u30F3\u30AF\u30A8\u30B9\u30C8\u30FB\u30C0\u30A4");
  });

  it("should strip currency symbols", () => {
    expect(sanitizeGameTitle("Game $100")).toBe("Game 100");
  });

  it("should strip emoji", () => {
    expect(sanitizeGameTitle("Game \uD83C\uDFAE Edition")).toBe("Game Edition");
  });
});
