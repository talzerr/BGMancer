// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TrackStatus } from "@/types";
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

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockPlayerContext = {
  playlist: {
    tracks: [] as PlaylistTrack[],
    tracksLoading: false,
    generating: false,
    importing: false,
    genProgress: null,
    genGlobalMsg: null,
    genError: null,
    importUrl: "",
    importError: null,
    cooldownUntil: null,
    currentSessionId: null,
    rerollingIds: new Set<string>(),
    setImportUrl: vi.fn(),
    handleGenerate: vi.fn(),
    handleImport: vi.fn(),
    loadForSession: vi.fn(),
    fetchTracks: vi.fn(),
    removeTrackLocal: vi.fn(),
    reorderTracks: vi.fn(),
    rerollTrack: vi.fn(),
  },
  player: {
    playerBarRef: { current: null },
    currentTrackIndex: 0,
    effectiveFoundTracks: [] as PlaylistTrack[],
    isPlayerPlaying: false,
    playingTrackId: null as string | null,
    playedTrackIds: new Set<string>(),
    shuffleMode: false,
    setCurrentTrackIndex: vi.fn(),
    setIsPlayerPlaying: vi.fn(),
    handleToggleShuffle: vi.fn(),
    clearPlayedTracks: vi.fn(),
    reset: vi.fn(),
    startPlaying: vi.fn(),
    playingSessionId: null as string | null,
  },
  config: {
    targetTrackCount: 50,
    antiSpoilerEnabled: false,
    allowLongTracks: false,
    allowShortTracks: true,
    rawVibes: false,
    setTargetTrackCount: vi.fn(),
    saveTrackCount: vi.fn(),
    saveAllowLongTracks: vi.fn(),
    saveAllowShortTracks: vi.fn(),
    saveAntiSpoiler: vi.fn(),
    saveRawVibes: vi.fn(),
  },
  gameLibrary: {
    games: [],
    fetchGames: vi.fn(),
  },
  gameThumbnailByGameId: new Map<string, string>(),
};

const mockSessionManager = {
  sessions: [],
  fetchSessions: vi.fn(),
  handleRenameSession: vi.fn(),
  handleDeleteSession: vi.fn(),
};

const mockTrackDeleteUndo = {
  pendingDelete: null as { track: PlaylistTrack; position: number } | null,
  initiateRemove: vi.fn(),
  undoRemove: vi.fn(),
};

vi.mock("@/context/player-context", () => ({
  usePlayerContext: () => mockPlayerContext,
}));

vi.mock("@/hooks/useSessionManager", () => ({
  useSessionManager: () => mockSessionManager,
}));

vi.mock("@/hooks/useTrackDeleteUndo", () => ({
  useTrackDeleteUndo: () => mockTrackDeleteUndo,
}));

vi.mock("@/components/GenerateSection", () => ({
  GenerateSection: () => <div data-testid="generate-section" />,
}));

vi.mock("@/components/SessionList", () => ({
  SessionList: () => <div data-testid="session-list" />,
  formatSessionName: (name: string) => name,
}));

vi.mock("@/components/PlaylistHeader", () => ({
  PlaylistHeader: () => <div data-testid="playlist-header" />,
}));

vi.mock("@/components/LibraryWidget", () => ({
  LibraryWidget: () => <div data-testid="library-widget" />,
}));

vi.mock("@/components/PlaylistEmptyState", () => ({
  PlaylistEmptyState: () => <div data-testid="playlist-empty-state" />,
}));

vi.mock("@/components/SortableTrackItem", () => ({
  SortableTrackItem: ({ track }: { track: PlaylistTrack }) => (
    <div data-testid={`track-${track.id}`}>{track.track_name ?? track.video_title}</div>
  ),
}));

vi.mock("@/components/UndoToast", () => ({
  UndoToast: () => <div data-testid="undo-toast" />,
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  PointerSensor: vi.fn(),
  KeyboardSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: vi.fn(),
  arrayMove: vi.fn(),
}));

import { FeedClient } from "../feed-client";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  // Reset mutable mock state
  mockPlayerContext.playlist.tracks = [];
  mockPlayerContext.playlist.tracksLoading = false;
  mockPlayerContext.playlist.generating = false;
  mockPlayerContext.playlist.importing = false;
  mockPlayerContext.gameLibrary.games = [];
  mockTrackDeleteUndo.pendingDelete = null;
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
    search_queries: null,
    duration_seconds: TEST_DURATION_SECONDS,
    position: 0,
    status: TrackStatus.Found,
    error_message: null,
    created_at: new Date().toISOString(),
    synced_at: null,
    ...overrides,
  };
}

function renderFeedClient(props: Partial<{ isSignedIn: boolean; authConfigured: boolean }> = {}) {
  return render(
    <FeedClient
      isSignedIn={props.isSignedIn ?? false}
      authConfigured={props.authConfigured ?? false}
    />,
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("FeedClient", () => {
  describe("when no tracks and no session", () => {
    it("should show the empty state", () => {
      renderFeedClient();
      expect(screen.getByTestId("playlist-empty-state")).toBeInTheDocument();
    });

    it("should not show track items", () => {
      renderFeedClient();
      expect(screen.queryByTestId(/^track-/)).not.toBeInTheDocument();
    });
  });

  describe("when tracks exist", () => {
    it("should render track list items", () => {
      const tracks = [
        makeTrack({ id: "pt-1", track_name: "Firelink Shrine", position: 0 }),
        makeTrack({ id: "pt-2", track_name: "Greenpath", position: 1 }),
      ];
      mockPlayerContext.playlist.tracks = tracks;
      renderFeedClient();
      expect(screen.getByTestId("track-pt-1")).toBeInTheDocument();
      expect(screen.getByTestId("track-pt-2")).toBeInTheDocument();
    });

    it("should not show the empty state", () => {
      mockPlayerContext.playlist.tracks = [makeTrack({ id: "pt-1", position: 0 })];
      renderFeedClient();
      expect(screen.queryByTestId("playlist-empty-state")).not.toBeInTheDocument();
    });
  });

  describe("when tracks are loading", () => {
    it("should show skeleton loaders instead of tracks or empty state", () => {
      mockPlayerContext.playlist.tracksLoading = true;
      const { container } = renderFeedClient();
      const skeletons = container.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
      expect(screen.queryByTestId("playlist-empty-state")).not.toBeInTheDocument();
    });
  });

  describe("composition", () => {
    it("should render GenerateSection", () => {
      renderFeedClient();
      expect(screen.getByTestId("generate-section")).toBeInTheDocument();
    });

    it("should render SessionList", () => {
      renderFeedClient();
      expect(screen.getByTestId("session-list")).toBeInTheDocument();
    });

    it("should render PlaylistHeader", () => {
      renderFeedClient();
      expect(screen.getByTestId("playlist-header")).toBeInTheDocument();
    });

    it("should render LibraryWidget", () => {
      renderFeedClient();
      expect(screen.getByTestId("library-widget")).toBeInTheDocument();
    });
  });

  describe("when a track delete is pending", () => {
    it("should show the undo toast", () => {
      mockTrackDeleteUndo.pendingDelete = {
        track: makeTrack({ id: "pt-undo" }),
        position: 0,
      };
      renderFeedClient();
      expect(screen.getByTestId("undo-toast")).toBeInTheDocument();
    });
  });

  describe("when no track delete is pending", () => {
    it("should not show the undo toast", () => {
      renderFeedClient();
      expect(screen.queryByTestId("undo-toast")).not.toBeInTheDocument();
    });
  });
});
