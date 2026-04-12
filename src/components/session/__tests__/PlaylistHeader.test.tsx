// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaylistMode } from "@/types";
import type { PlaylistTrack, PlaylistSessionWithCount } from "@/types";
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
  TEST_SESSION_NAME,
  TEST_USER_ID,
} from "@/test/constants";

// ─── File-level constants ──────────────────────────────────────────────────

const SESSION_ID = "session-1";

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
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeSession(overrides: Partial<PlaylistSessionWithCount> = {}): PlaylistSessionWithCount {
  return {
    id: SESSION_ID,
    user_id: TEST_USER_ID,
    name: TEST_SESSION_NAME,
    description: null,
    is_archived: false,
    playlist_mode: PlaylistMode.Journey,
    youtube_playlist_id: null,
    created_at: "2026-01-01T00:00:00Z",
    track_count: 5,
    ...overrides,
  };
}

// ─── Mocks ─────────────────────────────────────────────────────────────────

let mockContext: Record<string, unknown>;

vi.mock("@/context/player-context", () => ({
  usePlayerContext: () => mockContext,
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

// Dynamic import so vi.mock runs first
async function importComponent() {
  const mod = await import("../PlaylistHeader");
  return mod.PlaylistHeader;
}

const defaultProps = {
  sessions: [makeSession()],
  currentSessionId: SESSION_ID as string | null,
  tracks: [] as PlaylistTrack[],
  isSignedIn: true,
  isDev: true,
  youtubeSyncEnabled: false,
  onRename: vi.fn().mockResolvedValue(undefined),
  onDeleteSession: vi.fn().mockResolvedValue(undefined),
  shortPlaylistNotice: null as { text: string } | null,
};

afterEach(() => {
  cleanup();
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("PlaylistHeader", () => {
  beforeEach(() => {
    mockContext = {
      playlist: {
        confirmClear: false,
        setConfirmClear: vi.fn(),
      },
      config: {
        antiSpoilerEnabled: false,
        saveAntiSpoiler: vi.fn(),
      },
      player: {
        startPlaying: vi.fn(),
        playingSessionId: null,
        playingTrackId: null,
      },
    };
  });

  describe("when currentSessionId is null", () => {
    it("should render nothing", async () => {
      const PlaylistHeader = await importComponent();
      const { container } = render(<PlaylistHeader {...defaultProps} currentSessionId={null} />);
      expect(container.innerHTML).toBe("");
    });

    it("should not show any track stats", async () => {
      const PlaylistHeader = await importComponent();
      render(<PlaylistHeader {...defaultProps} currentSessionId={null} />);
      expect(screen.queryByText(/track/)).not.toBeInTheDocument();
    });
  });

  describe("when session exists with tracks", () => {
    it("should show track count", async () => {
      const PlaylistHeader = await importComponent();
      const tracks = [makeTrack(), makeTrack(), makeTrack()];
      render(<PlaylistHeader {...defaultProps} tracks={tracks} />);
      expect(screen.getByText(/3 tracks/)).toBeInTheDocument();
    });

    it("should show session name", async () => {
      const PlaylistHeader = await importComponent();
      const tracks = [makeTrack()];
      render(<PlaylistHeader {...defaultProps} tracks={tracks} />);
      expect(
        screen.getByRole("button", { name: new RegExp(TEST_SESSION_NAME) }),
      ).toBeInTheDocument();
    });
  });

  describe("when session has tracks", () => {
    it("should show total duration", async () => {
      const PlaylistHeader = await importComponent();
      // Two tracks: 240s + 360s = 600s = 10m
      const tracks = [makeTrack({ duration_seconds: 240 }), makeTrack({ duration_seconds: 360 })];
      render(<PlaylistHeader {...defaultProps} tracks={tracks} />);
      expect(screen.getByText(/10m/)).toBeInTheDocument();
    });

    it("should show track count with tracks label", async () => {
      const PlaylistHeader = await importComponent();
      const tracks = [makeTrack(), makeTrack(), makeTrack()];
      render(<PlaylistHeader {...defaultProps} tracks={tracks} />);
      expect(screen.getByText(/3 tracks/)).toBeInTheDocument();
    });

    it("should NOT append a mode suffix to the metadata line for Journey", async () => {
      const PlaylistHeader = await importComponent();
      const tracks = [makeTrack()];
      const { container } = render(<PlaylistHeader {...defaultProps} tracks={tracks} />);
      const metadata = container.querySelector(".tabular-nums");
      expect(metadata?.textContent).not.toMatch(/Journey/i);
    });

    it("should append the mode name for energy-mode sessions", async () => {
      const PlaylistHeader = await importComponent();
      const tracks = [makeTrack()];
      const sessions = [makeSession({ playlist_mode: PlaylistMode.Rush })];
      render(<PlaylistHeader {...defaultProps} sessions={sessions} tracks={tracks} />);
      expect(screen.getByText(/· Rush/)).toBeInTheDocument();
    });

    it("should render the short-playlist notice text when set", async () => {
      const PlaylistHeader = await importComponent();
      const tracks = [makeTrack(), makeTrack(), makeTrack()];
      render(
        <PlaylistHeader
          {...defaultProps}
          tracks={tracks}
          shortPlaylistNotice={{ text: "Matched 3 tracks for Chill" }}
        />,
      );
      expect(screen.getByText("Matched 3 tracks for Chill")).toBeInTheDocument();
    });

    it("should NOT render the notice when shortPlaylistNotice is null", async () => {
      const PlaylistHeader = await importComponent();
      const tracks = [makeTrack()];
      render(<PlaylistHeader {...defaultProps} tracks={tracks} shortPlaylistNotice={null} />);
      expect(screen.queryByText(/Matched/i)).not.toBeInTheDocument();
    });
  });

  describe("when title is clicked", () => {
    it("should enter edit mode and show textarea", async () => {
      const PlaylistHeader = await importComponent();
      const user = userEvent.setup();
      const tracks = [makeTrack()];

      render(<PlaylistHeader {...defaultProps} tracks={tracks} />);

      // Click the title button to enter edit mode
      const titleButton = screen.getByRole("button", { name: new RegExp(TEST_SESSION_NAME) });
      await user.click(titleButton);

      // Should now show a textarea with the session name
      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue(TEST_SESSION_NAME);
    });

    it("should not show the title button while editing", async () => {
      const PlaylistHeader = await importComponent();
      const user = userEvent.setup();
      const tracks = [makeTrack()];

      render(<PlaylistHeader {...defaultProps} tracks={tracks} />);

      await user.click(screen.getByRole("button", { name: new RegExp(TEST_SESSION_NAME) }));

      // The button containing the session name should be gone (replaced by textarea)
      expect(
        screen.queryByRole("button", { name: new RegExp(TEST_SESSION_NAME) }),
      ).not.toBeInTheDocument();
    });
  });

  describe("when all tracks are present", () => {
    it("should show track count and tracks label", async () => {
      const PlaylistHeader = await importComponent();
      const tracks = [makeTrack(), makeTrack(), makeTrack()];
      render(<PlaylistHeader {...defaultProps} tracks={tracks} />);
      expect(screen.getByText(/3 tracks/)).toBeInTheDocument();
    });
  });

  describe("Play All button", () => {
    it("should show Play All when there are tracks", async () => {
      const PlaylistHeader = await importComponent();
      const tracks = [makeTrack()];
      render(<PlaylistHeader {...defaultProps} tracks={tracks} />);
      expect(screen.getByText("Play All")).toBeInTheDocument();
    });

    it("should not show Play All when there are no tracks", async () => {
      const PlaylistHeader = await importComponent();
      render(<PlaylistHeader {...defaultProps} tracks={[]} />);
      expect(screen.queryByText("Play All")).not.toBeInTheDocument();
    });

    it("should call startPlaying with tracks when clicked", async () => {
      const PlaylistHeader = await importComponent();
      const user = userEvent.setup();
      const track = makeTrack();
      const tracks = [track];
      const startPlayingMock = vi.fn();
      mockContext = {
        ...mockContext,
        player: {
          ...(mockContext.player as Record<string, unknown>),
          startPlaying: startPlayingMock,
        },
      };

      render(<PlaylistHeader {...defaultProps} tracks={tracks} />);
      await user.click(screen.getByText("Play All"));

      expect(startPlayingMock).toHaveBeenCalledTimes(1);
      expect(startPlayingMock).toHaveBeenCalledWith([track], 0, SESSION_ID);
    });
  });

  describe("Sync link", () => {
    const baseProps = {
      ...defaultProps,
      isSignedIn: true,
      isDev: false,
      youtubeSyncEnabled: true,
      tracks: [makeTrack()],
    };

    it("is hidden for guests", async () => {
      const PlaylistHeader = await importComponent();
      render(<PlaylistHeader {...baseProps} isSignedIn={false} />);
      expect(screen.queryByRole("button", { name: "Sync" })).not.toBeInTheDocument();
    });

    it("is hidden in dev mode", async () => {
      const PlaylistHeader = await importComponent();
      render(<PlaylistHeader {...baseProps} isDev={true} />);
      expect(screen.queryByRole("button", { name: "Sync" })).not.toBeInTheDocument();
    });

    it("is hidden when the YouTube sync feature flag is off", async () => {
      const PlaylistHeader = await importComponent();
      render(<PlaylistHeader {...baseProps} youtubeSyncEnabled={false} />);
      expect(screen.queryByRole("button", { name: "Sync" })).not.toBeInTheDocument();
    });

    it("renders 'Sync' when the current session has no youtube_playlist_id", async () => {
      const PlaylistHeader = await importComponent();
      render(<PlaylistHeader {...baseProps} sessions={[makeSession()]} />);
      expect(screen.getByRole("button", { name: "Sync" })).toBeInTheDocument();
    });

    it("renders 'Synced' when the current session has a youtube_playlist_id", async () => {
      const PlaylistHeader = await importComponent();
      render(
        <PlaylistHeader
          {...baseProps}
          sessions={[makeSession({ youtube_playlist_id: "PL_existing" })]}
        />,
      );
      expect(screen.getByRole("button", { name: /Synced/ })).toBeInTheDocument();
    });

    it("opens the YouTube URL in a new tab when '✓ Synced' is clicked", async () => {
      const PlaylistHeader = await importComponent();
      const user = userEvent.setup();
      const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

      render(
        <PlaylistHeader
          {...baseProps}
          sessions={[makeSession({ youtube_playlist_id: "PL_existing" })]}
        />,
      );
      await user.click(screen.getByRole("button", { name: /Synced/ }));

      expect(openSpy).toHaveBeenCalledWith(
        "https://www.youtube.com/playlist?list=PL_existing",
        "_blank",
        "noopener,noreferrer",
      );
      openSpy.mockRestore();
    });

    it("opens the confirmation dialog when 'Sync' is clicked", async () => {
      const PlaylistHeader = await importComponent();
      const user = userEvent.setup();
      render(<PlaylistHeader {...baseProps} sessions={[makeSession()]} />);

      await user.click(screen.getByRole("button", { name: "Sync" }));

      expect(screen.getByRole("heading", { name: "Sync to YouTube" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Sync to YouTube" })).toBeInTheDocument();
    });
  });
});
