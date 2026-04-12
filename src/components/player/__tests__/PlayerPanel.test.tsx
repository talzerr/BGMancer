// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PlaylistTrack } from "@/types";
import {
  TEST_PLAYLIST_TRACK_ID,
  TEST_PLAYLIST_ID,
  TEST_GAME_ID,
  TEST_GAME_TITLE,
  TEST_TRACK_NAME,
  TEST_VIDEO_ID,
  TEST_VIDEO_TITLE,
  TEST_CHANNEL_TITLE,
  TEST_THUMBNAIL_URL,
  TEST_DURATION_SECONDS,
} from "@/test/constants";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

const mockTogglePlayPause = vi.fn();
const mockSetCurrentTrackIndex = vi.fn();
const mockStartPlaying = vi.fn();
const mockApplyVolume = vi.fn();

function makeTrack(overrides: Partial<PlaylistTrack> = {}): PlaylistTrack {
  return {
    id: TEST_PLAYLIST_TRACK_ID,
    playlist_id: TEST_PLAYLIST_ID,
    game_id: TEST_GAME_ID,
    game_title: TEST_GAME_TITLE,
    track_name: TEST_TRACK_NAME,
    video_id: TEST_VIDEO_ID,
    video_title: TEST_VIDEO_TITLE,
    channel_title: TEST_CHANNEL_TITLE,
    thumbnail: TEST_THUMBNAIL_URL,
    duration_seconds: TEST_DURATION_SECONDS,
    position: 0,
    created_at: "2025-01-01",
    ...overrides,
  };
}

function mockContextWith(overrides: {
  currentTrackIndex?: number | null;
  tracks?: PlaylistTrack[];
  isPlaying?: boolean;
  volume?: number;
  currentTime?: number;
  duration?: number;
}) {
  const tracks = overrides.tracks ?? [];
  const hasMedia =
    overrides.currentTrackIndex !== null && overrides.currentTrackIndex !== undefined;

  vi.doMock("@/context/player-context", () => ({
    usePlayerContext: () => ({
      player: {
        playingTracks: tracks,
        currentTrackIndex: overrides.currentTrackIndex ?? null,
        setCurrentTrackIndex: mockSetCurrentTrackIndex,
        startPlaying: mockStartPlaying,
      },
      playlist: { tracks, currentSessionId: "s1" },
      media: hasMedia
        ? {
            isPlaying: overrides.isPlaying ?? false,
            currentTime: overrides.currentTime ?? 0,
            duration: overrides.duration ?? 0,
            volume: overrides.volume ?? 80,
            togglePlayPause: mockTogglePlayPause,
            applyVolume: mockApplyVolume,
          }
        : null,
      gameThumbnailByGameId: new Map(),
    }),
  }));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("PlayerPanel", () => {
  describe("when no track is active", () => {
    it("should render an empty placeholder", async () => {
      mockContextWith({ currentTrackIndex: null, tracks: [] });
      const { PlayerPanel } = await import("../PlayerPanel");
      render(<PlayerPanel />);
      expect(screen.getByRole("complementary")).toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("should render a play button", async () => {
      mockContextWith({ currentTrackIndex: null, tracks: [] });
      const { PlayerPanel } = await import("../PlayerPanel");
      render(<PlayerPanel />);
      expect(screen.getByLabelText("Play")).toBeInTheDocument();
    });
  });

  describe("when a track is active", () => {
    it("should render a YouTube link with the correct href", async () => {
      const track = makeTrack();
      mockContextWith({ currentTrackIndex: 0, tracks: [track] });
      const { PlayerPanel } = await import("../PlayerPanel");
      render(<PlayerPanel />);
      const link = screen.getByTitle("Watch on YouTube");
      expect(link).toHaveAttribute("href", `https://www.youtube.com/watch?v=${TEST_VIDEO_ID}`);
    });

    it("should render cover art", async () => {
      const track = makeTrack();
      mockContextWith({ currentTrackIndex: 0, tracks: [track] });
      const { PlayerPanel } = await import("../PlayerPanel");
      const { container } = render(<PlayerPanel />);
      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();
    });
  });

  describe("transport controls", () => {
    it("should call togglePlayPause when play button is clicked", async () => {
      const track = makeTrack();
      mockContextWith({ currentTrackIndex: 0, tracks: [track], isPlaying: false });
      const { PlayerPanel } = await import("../PlayerPanel");
      render(<PlayerPanel />);
      await userEvent.click(screen.getByLabelText("Play"));
      expect(mockTogglePlayPause).toHaveBeenCalled();
    });

    it("should show Pause label when playing", async () => {
      const track = makeTrack();
      mockContextWith({ currentTrackIndex: 0, tracks: [track], isPlaying: true });
      const { PlayerPanel } = await import("../PlayerPanel");
      render(<PlayerPanel />);
      expect(screen.getByLabelText("Pause")).toBeInTheDocument();
    });

    it("should disable previous button when at first track", async () => {
      const track = makeTrack();
      mockContextWith({ currentTrackIndex: 0, tracks: [track] });
      const { PlayerPanel } = await import("../PlayerPanel");
      render(<PlayerPanel />);
      expect(screen.getByLabelText("Previous track")).toBeDisabled();
    });

    it("should disable next button when at last track", async () => {
      const track = makeTrack();
      mockContextWith({ currentTrackIndex: 0, tracks: [track] });
      const { PlayerPanel } = await import("../PlayerPanel");
      render(<PlayerPanel />);
      expect(screen.getByLabelText("Next track")).toBeDisabled();
    });

    it("should enable prev/next when in the middle of the list", async () => {
      const tracks = [makeTrack({ id: "t1" }), makeTrack({ id: "t2" }), makeTrack({ id: "t3" })];
      mockContextWith({ currentTrackIndex: 1, tracks });
      const { PlayerPanel } = await import("../PlayerPanel");
      render(<PlayerPanel />);
      expect(screen.getByLabelText("Previous track")).not.toBeDisabled();
      expect(screen.getByLabelText("Next track")).not.toBeDisabled();
    });

    it("should call setCurrentTrackIndex when next is clicked", async () => {
      const tracks = [makeTrack({ id: "t1" }), makeTrack({ id: "t2" })];
      mockContextWith({ currentTrackIndex: 0, tracks });
      const { PlayerPanel } = await import("../PlayerPanel");
      render(<PlayerPanel />);
      await userEvent.click(screen.getByLabelText("Next track"));
      expect(mockSetCurrentTrackIndex).toHaveBeenCalledWith(1);
    });
  });

  describe("progress bar", () => {
    it("should show progress fill based on currentTime / duration", async () => {
      const track = makeTrack();
      mockContextWith({ currentTrackIndex: 0, tracks: [track], currentTime: 60, duration: 240 });
      const { PlayerPanel } = await import("../PlayerPanel");
      const { container } = render(<PlayerPanel />);
      const fill = container.querySelector(".bg-primary.h-full");
      expect(fill).toHaveStyle({ width: "25%" });
    });
  });
});
