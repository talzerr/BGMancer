// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { CurationMode } from "@/types";
import { readGuestLibrary, writeGuestLibrary } from "../guest-library";

beforeEach(() => {
  localStorage.clear();
});

describe("readGuestLibrary", () => {
  it("should return empty array when nothing stored", () => {
    expect(readGuestLibrary()).toEqual([]);
  });

  it("should return stored entries", () => {
    const entries = [{ gameId: "g1", curation: CurationMode.Focus }];
    localStorage.setItem("bgm_guest_library", JSON.stringify(entries));
    expect(readGuestLibrary()).toEqual(entries);
  });

  it("should return empty array for invalid JSON", () => {
    localStorage.setItem("bgm_guest_library", "not-json");
    expect(readGuestLibrary()).toEqual([]);
  });

  it("should return empty array for non-array JSON", () => {
    localStorage.setItem("bgm_guest_library", '{"foo":"bar"}');
    expect(readGuestLibrary()).toEqual([]);
  });
});

describe("writeGuestLibrary", () => {
  it("should persist entries to localStorage", () => {
    const entries = [
      { gameId: "g1", curation: CurationMode.Include },
      { gameId: "g2", curation: CurationMode.Lite },
    ];
    writeGuestLibrary(entries);
    expect(JSON.parse(localStorage.getItem("bgm_guest_library")!)).toEqual(entries);
  });
});
