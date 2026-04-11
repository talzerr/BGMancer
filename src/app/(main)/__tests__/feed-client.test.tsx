// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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
    isLoading: false,
    generating: false,
    genError: null,
    cooldownUntil: null,
    currentSessionId: null,
    rerollingIds: new Set<string>(),
    handleGenerate: vi.fn(),
    loadForSession: vi.fn(),
    fetchTracks: vi.fn(),
    removeTrackLocal: vi.fn(),
    rerollTrack: vi.fn(),
  },
  player: {
    currentTrackIndex: 0,
    playingTracks: [] as PlaylistTrack[],
    isPlayerPlaying: false,
    playingTrackId: null as string | null,
    playedTrackIds: new Set<string>(),
    setCurrentTrackIndex: vi.fn(),
    setIsPlayerPlaying: vi.fn(),
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
    playlistMode: "journey",
    setTargetTrackCount: vi.fn(),
    saveTrackCount: vi.fn(),
    saveAllowLongTracks: vi.fn(),
    saveAllowShortTracks: vi.fn(),
    saveAntiSpoiler: vi.fn(),
    savePlaylistMode: vi.fn(),
  },
  gameLibrary: {
    games: [],
    fetchGames: vi.fn(),
  },
  gameThumbnailByGameId: new Map<string, string>(),
  isSignedIn: false,
  toggleAntiSpoiler: vi.fn(),
  media: null,
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

vi.mock("@/hooks/library/useSessionManager", () => ({
  useSessionManager: () => mockSessionManager,
}));

vi.mock("@/hooks/player/useTrackDeleteUndo", () => ({
  useTrackDeleteUndo: () => mockTrackDeleteUndo,
}));

vi.mock("@/components/generate/GenerateSection", () => ({
  GenerateSection: () => <div data-testid="generate-section" />,
}));

vi.mock("@/components/session/SessionList", () => ({
  SessionList: () => <div data-testid="session-list" />,
  formatSessionName: (name: string) => name,
}));

vi.mock("@/components/session/PlaylistHeader", () => ({
  PlaylistHeader: () => <div data-testid="playlist-header" />,
}));

vi.mock("@/components/library/LibraryWidget", () => ({
  LibraryWidget: () => <div data-testid="library-widget" />,
}));

vi.mock("@/components/launchpad/Launchpad", () => ({
  Launchpad: () => <div data-testid="launchpad" />,
}));

vi.mock("@/components/player/PlaylistTrackCard", () => ({
  PlaylistTrackCard: ({ track }: { track: PlaylistTrack }) => (
    <div data-testid={`track-${track.id}`}>{track.track_name ?? track.video_title}</div>
  ),
}));

vi.mock("@/components/player/UndoToast", () => ({
  UndoToast: () => <div data-testid="undo-toast" />,
}));

vi.mock("@/components/player/PlayerPanel", () => ({
  PlayerPanel: () => <div data-testid="player-panel" />,
}));

vi.mock("@/components/AuthButtons", () => ({
  AuthButtons: () => <div data-testid="auth-buttons" />,
  performSignOut: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

import { FeedClient } from "../FeedClient";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  // Reset mutable mock state
  mockPlayerContext.playlist.tracks = [];
  mockPlayerContext.playlist.isLoading = false;
  mockPlayerContext.playlist.generating = false;
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
    duration_seconds: TEST_DURATION_SECONDS,
    position: 0,
    created_at: new Date().toISOString(),
    synced_at: null,
    ...overrides,
  };
}

function renderFeedClient(
  props: Partial<{ isSignedIn: boolean; isDev: boolean; youtubeSyncEnabled: boolean }> = {},
) {
  return render(
    <FeedClient
      isSignedIn={props.isSignedIn ?? false}
      isDev={props.isDev ?? false}
      youtubeSyncEnabled={props.youtubeSyncEnabled ?? false}
      user={null}
      previewCovers={[]}
    />,
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("FeedClient", () => {
  describe("when no tracks and not generating", () => {
    it("should render the launchpad", () => {
      renderFeedClient();
      expect(screen.getByTestId("launchpad")).toBeInTheDocument();
    });

    it("should not render the playlist controls column", () => {
      renderFeedClient();
      expect(screen.queryByTestId("library-widget")).not.toBeInTheDocument();
      expect(screen.queryByTestId("generate-section")).not.toBeInTheDocument();
      expect(screen.queryByTestId("playlist-header")).not.toBeInTheDocument();
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

    it("should not render the launchpad", () => {
      mockPlayerContext.playlist.tracks = [makeTrack({ id: "pt-1", position: 0 })];
      renderFeedClient();
      expect(screen.queryByTestId("launchpad")).not.toBeInTheDocument();
    });
  });

  describe("when generation is in flight without tracks", () => {
    it("should keep the launchpad mounted", () => {
      mockPlayerContext.playlist.generating = true;
      renderFeedClient();
      expect(screen.getByTestId("launchpad")).toBeInTheDocument();
      expect(screen.queryByTestId("library-widget")).not.toBeInTheDocument();
    });
  });

  describe("composition (playlist mode)", () => {
    it("should render GenerateSection", () => {
      mockPlayerContext.playlist.tracks = [makeTrack({ id: "pt-1", position: 0 })];
      renderFeedClient();
      expect(screen.getByTestId("generate-section")).toBeInTheDocument();
    });

    it("should render SessionList when signed in", () => {
      mockPlayerContext.playlist.tracks = [makeTrack({ id: "pt-1", position: 0 })];
      renderFeedClient({ isSignedIn: true });
      expect(screen.getByTestId("session-list")).toBeInTheDocument();
    });

    it("should not render SessionList for guests", () => {
      mockPlayerContext.playlist.tracks = [makeTrack({ id: "pt-1", position: 0 })];
      renderFeedClient({ isSignedIn: false });
      expect(screen.queryByTestId("session-list")).not.toBeInTheDocument();
    });

    it("should render PlaylistHeader", () => {
      mockPlayerContext.playlist.tracks = [makeTrack({ id: "pt-1", position: 0 })];
      renderFeedClient();
      expect(screen.getByTestId("playlist-header")).toBeInTheDocument();
    });

    it("should render LibraryWidget", () => {
      mockPlayerContext.playlist.tracks = [makeTrack({ id: "pt-1", position: 0 })];
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
