// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackStatus } from "@/types";
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
    search_queries: null,
    duration_seconds: TEST_DURATION_SECONDS,
    position: 0,
    status: TrackStatus.Found,
    error_message: null,
    created_at: "2026-01-01T00:00:00Z",
    synced_at: null,
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

vi.mock("@/components/SyncButton", () => ({
  SyncButton: () => <div data-testid="sync-button" />,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

// Dynamic import so vi.mock runs first
async function importComponent() {
  const mod = await import("../PlaylistHeader");
  return mod.PlaylistHeader;
}

const defaultProps = {
  sessions: [makeSession()],
  isSignedIn: false,
  authConfigured: false,
  onRename: vi.fn().mockResolvedValue(undefined),
  onDeleteSession: vi.fn().mockResolvedValue(undefined),
};

afterEach(() => {
  cleanup();
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("PlaylistHeader", () => {
  beforeEach(() => {
    mockContext = {
      playlist: {
        tracks: [],
        currentSessionId: SESSION_ID,
        searching: false,
        confirmClear: false,
        setConfirmClear: vi.fn(),
        handleFindVideos: vi.fn(),
      },
      config: {
        antiSpoilerEnabled: false,
        saveAntiSpoiler: vi.fn(),
      },
    };
  });

  describe("when currentSessionId is null", () => {
    it("should render nothing", async () => {
      const PlaylistHeader = await importComponent();
      mockContext = {
        ...mockContext,
        playlist: {
          ...(mockContext.playlist as Record<string, unknown>),
          currentSessionId: null,
        },
      };

      const { container } = render(<PlaylistHeader {...defaultProps} />);
      expect(container.innerHTML).toBe("");
    });

    it("should not show any track stats", async () => {
      const PlaylistHeader = await importComponent();
      mockContext = {
        ...mockContext,
        playlist: {
          ...(mockContext.playlist as Record<string, unknown>),
          currentSessionId: null,
        },
      };

      render(<PlaylistHeader {...defaultProps} />);
      expect(screen.queryByText(/track/)).not.toBeInTheDocument();
    });
  });

  describe("when session exists with tracks", () => {
    it("should show track count", async () => {
      const PlaylistHeader = await importComponent();
      const tracks = [makeTrack(), makeTrack({ status: TrackStatus.Pending }), makeTrack()];
      mockContext = {
        ...mockContext,
        playlist: {
          ...(mockContext.playlist as Record<string, unknown>),
          tracks,
        },
      };

      render(<PlaylistHeader {...defaultProps} />);
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("tracks")).toBeInTheDocument();
    });

    it("should show session name", async () => {
      const PlaylistHeader = await importComponent();
      const tracks = [makeTrack()];
      mockContext = {
        ...mockContext,
        playlist: {
          ...(mockContext.playlist as Record<string, unknown>),
          tracks,
        },
      };

      render(<PlaylistHeader {...defaultProps} />);
      expect(screen.getByText(TEST_SESSION_NAME)).toBeInTheDocument();
    });
  });

  describe("when session has found tracks", () => {
    it("should show total duration", async () => {
      const PlaylistHeader = await importComponent();
      // Two found tracks: 240s + 360s = 600s = 10m
      const tracks = [makeTrack({ duration_seconds: 240 }), makeTrack({ duration_seconds: 360 })];
      mockContext = {
        ...mockContext,
        playlist: {
          ...(mockContext.playlist as Record<string, unknown>),
          tracks,
        },
      };

      render(<PlaylistHeader {...defaultProps} />);
      expect(screen.getByText("10m")).toBeInTheDocument();
    });

    it("should show found count with ready label", async () => {
      const PlaylistHeader = await importComponent();
      // 3 found tracks + 1 pending so the total count (4) differs from found count (3)
      const tracks = [
        makeTrack(),
        makeTrack(),
        makeTrack(),
        makeTrack({ status: TrackStatus.Pending }),
      ];
      mockContext = {
        ...mockContext,
        playlist: {
          ...(mockContext.playlist as Record<string, unknown>),
          tracks,
        },
      };

      render(<PlaylistHeader {...defaultProps} />);
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("ready")).toBeInTheDocument();
    });
  });

  describe("when title is clicked", () => {
    it("should enter edit mode and show textarea", async () => {
      const PlaylistHeader = await importComponent();
      const user = userEvent.setup();
      const tracks = [makeTrack()];
      mockContext = {
        ...mockContext,
        playlist: {
          ...(mockContext.playlist as Record<string, unknown>),
          tracks,
        },
      };

      render(<PlaylistHeader {...defaultProps} />);

      // Click the title button to enter edit mode
      const titleButton = screen.getByText(TEST_SESSION_NAME);
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
      mockContext = {
        ...mockContext,
        playlist: {
          ...(mockContext.playlist as Record<string, unknown>),
          tracks,
        },
      };

      render(<PlaylistHeader {...defaultProps} />);

      await user.click(screen.getByText(TEST_SESSION_NAME));

      // The button containing the session name should be gone (replaced by textarea)
      expect(
        screen.queryByRole("button", { name: new RegExp(TEST_SESSION_NAME) }),
      ).not.toBeInTheDocument();
    });
  });

  describe("when tracks have different statuses", () => {
    it("should show correct counts for pending, found, and error tracks", async () => {
      const PlaylistHeader = await importComponent();
      const tracks = [
        makeTrack({ status: TrackStatus.Found }),
        makeTrack({ status: TrackStatus.Found }),
        makeTrack({ status: TrackStatus.Pending }),
        makeTrack({ status: TrackStatus.Pending }),
        makeTrack({ status: TrackStatus.Pending }),
        makeTrack({ status: TrackStatus.Error }),
      ];
      mockContext = {
        ...mockContext,
        playlist: {
          ...(mockContext.playlist as Record<string, unknown>),
          tracks,
        },
      };

      render(<PlaylistHeader {...defaultProps} />);

      // Total track count
      expect(screen.getByText("6")).toBeInTheDocument();

      // Found count
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("ready")).toBeInTheDocument();

      // Pending count
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("pending")).toBeInTheDocument();

      // Error count
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("error")).toBeInTheDocument();
    });

    it("should not show pending section when there are no pending tracks", async () => {
      const PlaylistHeader = await importComponent();
      const tracks = [makeTrack({ status: TrackStatus.Found })];
      mockContext = {
        ...mockContext,
        playlist: {
          ...(mockContext.playlist as Record<string, unknown>),
          tracks,
        },
      };

      render(<PlaylistHeader {...defaultProps} />);
      expect(screen.queryByText("pending")).not.toBeInTheDocument();
    });

    it("should not show error section when there are no error tracks", async () => {
      const PlaylistHeader = await importComponent();
      const tracks = [makeTrack({ status: TrackStatus.Found })];
      mockContext = {
        ...mockContext,
        playlist: {
          ...(mockContext.playlist as Record<string, unknown>),
          tracks,
        },
      };

      render(<PlaylistHeader {...defaultProps} />);
      expect(screen.queryByText(/error/)).not.toBeInTheDocument();
    });
  });
});
