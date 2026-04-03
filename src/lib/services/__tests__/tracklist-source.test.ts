import { describe, it, expect } from "vitest";
import { parseSource, formatSource, sourceUrl, getRegisteredSources } from "../tracklist-source";

describe("parseSource", () => {
  it("parses valid source strings", () => {
    expect(parseSource("discogs-release:123")).toEqual({ key: "discogs-release", id: "123" });
    expect(parseSource("vgmdb:79")).toEqual({ key: "vgmdb", id: "79" });
    expect(parseSource("discogs-master:456")).toEqual({ key: "discogs-master", id: "456" });
  });

  it("returns null for invalid inputs", () => {
    expect(parseSource(null)).toBeNull();
    expect(parseSource("")).toBeNull();
    expect(parseSource("invalid")).toBeNull();
    expect(parseSource("no-id:")).toBeNull();
    expect(parseSource(":123")).toBeNull();
  });
});

describe("formatSource", () => {
  it("formats key and id into source string", () => {
    expect(formatSource("vgmdb", "79")).toBe("vgmdb:79");
    expect(formatSource("discogs-release", "123")).toBe("discogs-release:123");
  });
});

describe("sourceUrl", () => {
  it("returns external URL for known sources", () => {
    expect(sourceUrl("discogs-release:123")).toBe("https://www.discogs.com/release/123");
    expect(sourceUrl("discogs-master:456")).toBe("https://www.discogs.com/master/456");
    expect(sourceUrl("vgmdb:79")).toBe("https://vgmdb.net/album/79");
  });

  it("returns undefined for unknown or invalid sources", () => {
    expect(sourceUrl(null)).toBeUndefined();
    expect(sourceUrl("unknown-source:1")).toBeUndefined();
    expect(sourceUrl("invalid")).toBeUndefined();
  });
});

describe("getRegisteredSources", () => {
  it("returns all registered source keys and labels", () => {
    const sources = getRegisteredSources();
    expect(sources).toHaveLength(3);
    expect(sources.map((s) => s.key)).toEqual(["discogs-release", "discogs-master", "vgmdb"]);
    expect(sources.every((s) => s.label.length > 0)).toBe(true);
  });
});
