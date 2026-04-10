// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { CurationMode, OnboardingPhase } from "@/types";
import type { Game } from "@/types";
import {
  readGuestLibrary,
  writeGuestLibrary,
  readGuestLibraryHydrated,
  writeGuestLibraryHydrated,
  clearGuestLibrary,
} from "../guest-library";

function makeGame(id: string, title: string): Game {
  return {
    id,
    title,
    curation: CurationMode.Include,
    steam_appid: null,
    onboarding_phase: OnboardingPhase.Tagged,
    published: true,
    tracklist_source: null,
    yt_playlist_id: null,
    thumbnail_url: null,
    needs_review: false,
    created_at: "2026-04-06T00:00:00Z",
    updated_at: "2026-04-06T00:00:00Z",
  };
}

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

  it("should filter out malformed entries", () => {
    localStorage.setItem(
      "bgm_guest_library",
      JSON.stringify([
        { gameId: "g1", curation: "include" },
        { bad: true },
        "string",
        null,
        { gameId: "g2", curation: "focus" },
      ]),
    );
    expect(readGuestLibrary()).toEqual([
      { gameId: "g1", curation: "include" },
      { gameId: "g2", curation: "focus" },
    ]);
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

describe("readGuestLibraryHydrated", () => {
  it("should return empty array when nothing stored", () => {
    expect(readGuestLibraryHydrated()).toEqual([]);
  });

  it("should return stored games", () => {
    const games = [makeGame("g1", "Celeste"), makeGame("g2", "Hollow Knight")];
    localStorage.setItem("bgm_guest_library_hydrated", JSON.stringify(games));
    expect(readGuestLibraryHydrated()).toEqual(games);
  });

  it("should return empty array for invalid JSON", () => {
    localStorage.setItem("bgm_guest_library_hydrated", "not-json");
    expect(readGuestLibraryHydrated()).toEqual([]);
  });

  it("should return empty array for non-array JSON", () => {
    localStorage.setItem("bgm_guest_library_hydrated", '{"foo":"bar"}');
    expect(readGuestLibraryHydrated()).toEqual([]);
  });

  it("should filter out malformed entries", () => {
    const valid = makeGame("g1", "Celeste");
    localStorage.setItem(
      "bgm_guest_library_hydrated",
      JSON.stringify([valid, { bad: true }, "string", null, { id: "g2" }]),
    );
    expect(readGuestLibraryHydrated()).toEqual([valid]);
  });
});

describe("writeGuestLibraryHydrated", () => {
  it("should persist games to localStorage", () => {
    const games = [makeGame("g1", "Celeste")];
    writeGuestLibraryHydrated(games);
    expect(JSON.parse(localStorage.getItem("bgm_guest_library_hydrated")!)).toEqual(games);
  });
});

describe("clearGuestLibrary", () => {
  it("should remove both library keys from localStorage", () => {
    writeGuestLibrary([{ gameId: "g1", curation: CurationMode.Include }]);
    writeGuestLibraryHydrated([makeGame("g1", "Celeste")]);
    expect(localStorage.getItem("bgm_guest_library")).not.toBeNull();
    expect(localStorage.getItem("bgm_guest_library_hydrated")).not.toBeNull();

    clearGuestLibrary();

    expect(localStorage.getItem("bgm_guest_library")).toBeNull();
    expect(localStorage.getItem("bgm_guest_library_hydrated")).toBeNull();
  });

  it("should not throw when keys are already absent", () => {
    expect(() => clearGuestLibrary()).not.toThrow();
  });
});
