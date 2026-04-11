// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useConfig } from "../useConfig";
import { PlaylistMode } from "@/types";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("useConfig — playlist mode", () => {
  describe("when no value has been persisted", () => {
    it("defaults to Journey", async () => {
      const { result } = renderHook(() => useConfig());
      await waitFor(() => expect(result.current.playlistMode).toBe(PlaylistMode.Journey));
    });
  });

  describe("when a valid value is in localStorage", () => {
    it("hydrates from localStorage", async () => {
      localStorage.setItem("bgm_playlist_mode", "low");
      const { result } = renderHook(() => useConfig());
      await waitFor(() => expect(result.current.playlistMode).toBe(PlaylistMode.Chill));
    });
  });

  describe("when an unknown value is in localStorage", () => {
    it("falls back to Journey", async () => {
      localStorage.setItem("bgm_playlist_mode", "bogus");
      const { result } = renderHook(() => useConfig());
      await waitFor(() => expect(result.current.playlistMode).toBe(PlaylistMode.Journey));
    });
  });

  describe("savePlaylistMode", () => {
    it("updates the state and writes to localStorage", async () => {
      const { result } = renderHook(() => useConfig());
      await waitFor(() => expect(result.current.playlistMode).toBe(PlaylistMode.Journey));

      act(() => result.current.savePlaylistMode(PlaylistMode.Rush));

      expect(result.current.playlistMode).toBe(PlaylistMode.Rush);
      expect(localStorage.getItem("bgm_playlist_mode")).toBe("high");
    });
  });
});
