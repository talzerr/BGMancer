import { describe, it, expect } from "vitest";
import { PlaylistMode } from "@/types";
import { buildShortPlaylistMessage, formatShortPlaylistText } from "..";

describe("buildShortPlaylistMessage", () => {
  describe("when mode is Journey", () => {
    it("returns null even when count is below requested", () => {
      expect(buildShortPlaylistMessage(10, 50, PlaylistMode.Journey, "s1")).toBeNull();
    });
  });

  describe("when count equals requested", () => {
    it("returns null", () => {
      expect(buildShortPlaylistMessage(50, 50, PlaylistMode.Chill, "s1")).toBeNull();
    });
  });

  describe("when count exceeds requested", () => {
    it("returns null (the spec only fires below 100%)", () => {
      expect(buildShortPlaylistMessage(60, 50, PlaylistMode.Chill, "s1")).toBeNull();
    });
  });

  describe("partial tier (50-99% fill)", () => {
    it("returns partial when fill is exactly 50%", () => {
      const result = buildShortPlaylistMessage(25, 50, PlaylistMode.Chill, "s1");
      expect(result?.tier).toBe("partial");
    });

    it("returns partial at 99%", () => {
      const result = buildShortPlaylistMessage(49, 50, PlaylistMode.Mix, "s1");
      expect(result?.tier).toBe("partial");
    });

    it("uses the mode display name", () => {
      const result = buildShortPlaylistMessage(40, 50, PlaylistMode.Chill, "s1");
      expect(result?.modeName).toBe("Chill");
    });
  });

  describe("sparse tier (1-49% fill)", () => {
    it("returns sparse just below 50%", () => {
      const result = buildShortPlaylistMessage(24, 50, PlaylistMode.Rush, "s1");
      expect(result?.tier).toBe("sparse");
    });

    it("returns sparse for a single track", () => {
      const result = buildShortPlaylistMessage(1, 50, PlaylistMode.Chill, "s1");
      expect(result?.tier).toBe("sparse");
    });
  });

  describe("empty tier (0 tracks)", () => {
    it("returns empty when count is 0", () => {
      const result = buildShortPlaylistMessage(0, 50, PlaylistMode.Chill, "s1");
      expect(result?.tier).toBe("empty");
    });

    it("preserves the session id even for empty results", () => {
      const result = buildShortPlaylistMessage(0, 50, PlaylistMode.Rush, "s1");
      expect(result?.sessionId).toBe("s1");
    });
  });
});

describe("formatShortPlaylistText", () => {
  it("partial tier reads 'Matched N tracks for [Mode]'", () => {
    const msg = buildShortPlaylistMessage(40, 50, PlaylistMode.Chill, "s1")!;
    expect(formatShortPlaylistText(msg)).toBe("Matched 40 tracks for Chill");
  });

  it("sparse tier reads 'Only N tracks matched the current library in [Mode]'", () => {
    const msg = buildShortPlaylistMessage(10, 50, PlaylistMode.Rush, "s1")!;
    expect(formatShortPlaylistText(msg)).toBe("Only 10 tracks matched the current library in Rush");
  });

  it("empty tier reads the mode-agnostic destructive copy", () => {
    const msg = buildShortPlaylistMessage(0, 50, PlaylistMode.Mix, "s1")!;
    expect(formatShortPlaylistText(msg)).toBe("No tracks matched the current library in this mode");
  });
});
