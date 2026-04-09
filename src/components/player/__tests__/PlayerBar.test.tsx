// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PlaylistTrack } from "@/types";
import {
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

// ─── File-level constants ──────────────────────────────────────────────────

const SECOND_GAME_ID = "g2";
const SECOND_GAME_TITLE = "Hollow Knight";
const THIRD_GAME_ID = "g3";
const THIRD_GAME_TITLE = "Celeste";

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockMedia = {
  isPlaying: false,
  currentTime: 30,
  duration: 240,
  volume: 100,
  dimmed: false,
  togglePlayPause: vi.fn(),
  seekTo: vi.fn(),
  applyVolume: vi.fn(),
  toggleDim: vi.fn(),
};

let mockContext: Record<string, unknown>;

vi.mock("@/context/player-context", () => ({
  usePlayerContext: () => mockContext,
}));

vi.mock("next/image", () => ({
  default: (props: any) => <img {...props} />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeTrack(overrides: Partial<PlaylistTrack> = {}): PlaylistTrack {
  return {
    id: `pt-${Math.random().toString(36).slice(2, 8)}`,
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
    created_at: new Date().toISOString(),
    synced_at: null,
    ...overrides,
  };
}

function buildTracks(): PlaylistTrack[] {
  return [
    makeTrack({
      id: "pt-1",
      track_name: "Firelink Shrine",
      game_id: TEST_GAME_ID,
      game_title: TEST_GAME_TITLE,
      position: 0,
    }),
    makeTrack({
      id: "pt-2",
      track_name: "Greenpath",
      game_id: SECOND_GAME_ID,
      game_title: SECOND_GAME_TITLE,
      position: 1,
    }),
    makeTrack({
      id: "pt-3",
      track_name: "Resurrections",
      game_id: THIRD_GAME_ID,
      game_title: THIRD_GAME_TITLE,
      position: 2,
    }),
  ];
}

function buildContext(overrides: Record<string, unknown> = {}) {
  const tracks = (overrides.tracks as PlaylistTrack[] | undefined) ?? buildTracks();
  const currentIndex = (overrides.currentIndex as number | undefined) ?? 0;
  return {
    player: {
      effectiveFoundTracks: tracks,
      currentTrackIndex: tracks.length > 0 ? currentIndex : null,
      setCurrentTrackIndex: (overrides.onIndexChange as (() => void) | undefined) ?? vi.fn(),
      shuffleMode: (overrides.shuffleMode as boolean | undefined) ?? false,
      handleToggleShuffle: (overrides.onToggleShuffle as (() => void) | undefined) ?? vi.fn(),
    },
    media: tracks.length > 0 ? { ...mockMedia } : null,
    gameThumbnailByGameId: new Map<string, string>(),
    playerPanelActive: false,
    ...overrides,
  };
}

// Dynamic import so vi.mock runs first
async function importComponent() {
  const mod = await import("../PlayerBar");
  return mod.PlayerBar;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("PlayerBar", () => {
  beforeEach(() => {
    mockContext = buildContext();
  });

  describe("when rendered with tracks", () => {
    it("should show the current track title", async () => {
      const PlayerBar = await importComponent();
      render(<PlayerBar />);
      expect(screen.getByText("Firelink Shrine")).toBeInTheDocument();
    });

    it("should show the game title", async () => {
      const PlayerBar = await importComponent();
      render(<PlayerBar />);
      expect(screen.getByText(TEST_GAME_TITLE)).toBeInTheDocument();
    });

    it("should show formatted time", async () => {
      const PlayerBar = await importComponent();
      render(<PlayerBar />);
      expect(screen.getByText("0:30")).toBeInTheDocument();
      expect(screen.getByText("4:00")).toBeInTheDocument();
    });

    it("should show the track counter", async () => {
      const PlayerBar = await importComponent();
      render(<PlayerBar />);
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("should show the Up Next track info", async () => {
      const PlayerBar = await importComponent();
      render(<PlayerBar />);
      expect(screen.getByText("Up Next")).toBeInTheDocument();
      expect(screen.getByText("Greenpath")).toBeInTheDocument();
    });
  });

  describe("when track has no track_name", () => {
    it("should fall back to video_title", async () => {
      const PlayerBar = await importComponent();
      const tracks = buildTracks();
      tracks[0] = makeTrack({
        id: "pt-1",
        track_name: null,
        video_title: "Firelink Shrine - Dark Souls OST",
        position: 0,
      });
      mockContext = buildContext({ tracks });
      render(<PlayerBar />);
      expect(screen.getByText("Firelink Shrine - Dark Souls OST")).toBeInTheDocument();
    });
  });

  describe("when play/pause button is clicked", () => {
    it("should call togglePlayPause", async () => {
      const PlayerBar = await importComponent();
      const user = userEvent.setup();
      render(<PlayerBar />);
      const playButton = screen.getByRole("button", { name: "Play" });
      await user.click(playButton);
      expect(mockMedia.togglePlayPause).toHaveBeenCalledTimes(1);
    });
  });

  describe("when next button is clicked", () => {
    it("should call setCurrentTrackIndex with currentIndex + 1", async () => {
      const PlayerBar = await importComponent();
      const user = userEvent.setup();
      const onIndexChange = vi.fn();
      mockContext = buildContext({ currentIndex: 0, onIndexChange });
      render(<PlayerBar />);
      const nextButton = screen.getByRole("button", { name: "Next track" });
      await user.click(nextButton);
      expect(onIndexChange).toHaveBeenCalledWith(1);
    });
  });

  describe("when previous button is clicked", () => {
    it("should call setCurrentTrackIndex with currentIndex - 1", async () => {
      const PlayerBar = await importComponent();
      const user = userEvent.setup();
      const onIndexChange = vi.fn();
      mockContext = buildContext({ currentIndex: 1, onIndexChange });
      render(<PlayerBar />);
      const prevButton = screen.getByRole("button", { name: "Previous track" });
      await user.click(prevButton);
      expect(onIndexChange).toHaveBeenCalledWith(0);
    });
  });

  describe("when shuffle button is clicked", () => {
    it("should call handleToggleShuffle", async () => {
      const PlayerBar = await importComponent();
      const user = userEvent.setup();
      const onToggleShuffle = vi.fn();
      mockContext = buildContext({ onToggleShuffle });
      render(<PlayerBar />);
      const shuffleButton = screen.getByTitle(/Shuffle off/);
      await user.click(shuffleButton);
      expect(onToggleShuffle).toHaveBeenCalledTimes(1);
    });
  });

  describe("when at first track", () => {
    it("should disable the previous button", async () => {
      const PlayerBar = await importComponent();
      mockContext = buildContext({ currentIndex: 0 });
      render(<PlayerBar />);
      const prevButton = screen.getByRole("button", { name: "Previous track" });
      expect(prevButton).toBeDisabled();
    });

    it("should not call setCurrentTrackIndex when previous is clicked", async () => {
      const PlayerBar = await importComponent();
      const user = userEvent.setup();
      const onIndexChange = vi.fn();
      mockContext = buildContext({ currentIndex: 0, onIndexChange });
      render(<PlayerBar />);
      const prevButton = screen.getByRole("button", { name: "Previous track" });
      await user.click(prevButton);
      expect(onIndexChange).not.toHaveBeenCalled();
    });
  });

  describe("when at last track", () => {
    it("should disable the next button", async () => {
      const PlayerBar = await importComponent();
      mockContext = buildContext({ currentIndex: 2 });
      render(<PlayerBar />);
      const nextButton = screen.getByRole("button", { name: "Next track" });
      expect(nextButton).toBeDisabled();
    });
  });

  describe("when minimized", () => {
    it("should show the expand button after clicking minimize", async () => {
      const PlayerBar = await importComponent();
      const user = userEvent.setup();
      render(<PlayerBar />);
      const minimizeButton = screen.getByTitle("Minimize player");
      await user.click(minimizeButton);
      expect(screen.getByTitle("Expand player")).toBeInTheDocument();
    });

    it("should not show transport controls when minimized", async () => {
      const PlayerBar = await importComponent();
      const user = userEvent.setup();
      render(<PlayerBar />);
      const minimizeButton = screen.getByTitle("Minimize player");
      await user.click(minimizeButton);
      expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
    });
  });

  describe("when tracks array is empty", () => {
    it("should not render anything", async () => {
      const PlayerBar = await importComponent();
      mockContext = buildContext({ tracks: [] });
      const { container } = render(<PlayerBar />);
      expect(container.querySelector("input[aria-label='Seek']")).not.toBeInTheDocument();
    });
  });
});
