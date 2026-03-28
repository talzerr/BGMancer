// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CurationMode, OnboardingPhase } from "@/types";
import type { Game } from "@/types";
import { TEST_GAME_ID, TEST_GAME_TITLE, TEST_STEAM_APPID } from "@/test/constants";

// ─── File-level constants ──────────────────────────────────────────────────

const SECOND_GAME_ID = "g2";
const SECOND_GAME_TITLE = "Hollow Knight";
const THIRD_GAME_ID = "g3";
const THIRD_GAME_TITLE = "Celeste";

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockGameLibrary = {
  games: [] as Game[],
  fetchGames: vi.fn(),
};

vi.mock("@/context/player-context", () => ({
  usePlayerContext: () => ({
    gameLibrary: mockGameLibrary,
  }),
}));

vi.mock("@/components/GameRow", () => ({
  GameRow: ({ game }: { game: Game }) => <div data-testid={`game-${game.id}`}>{game.title}</div>,
  CurationLegend: () => null,
}));

vi.mock("@/components/CatalogBrowser", () => ({
  CatalogBrowser: () => <div data-testid="catalog-browser" />,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ─── fetch mock ────────────────────────────────────────────────────────────

let fetchGamesResponse: Game[] = [];

import { LibraryClient } from "../library-client";

beforeEach(() => {
  fetchGamesResponse = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    if (url.includes("/api/games")) {
      return new Response(JSON.stringify(fetchGamesResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("OK", { status: 200 });
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: TEST_GAME_ID,
    title: TEST_GAME_TITLE,
    curation: CurationMode.Include,
    steam_appid: TEST_STEAM_APPID,
    onboarding_phase: OnboardingPhase.Tagged,
    published: true,
    tracklist_source: null,
    yt_playlist_id: null,
    thumbnail_url: null,
    needs_review: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function buildGames(): Game[] {
  return [
    makeGame({ id: TEST_GAME_ID, title: TEST_GAME_TITLE, curation: CurationMode.Include }),
    makeGame({ id: SECOND_GAME_ID, title: SECOND_GAME_TITLE, curation: CurationMode.Skip }),
    makeGame({ id: THIRD_GAME_ID, title: THIRD_GAME_TITLE, curation: CurationMode.Focus }),
  ];
}

async function renderLibraryClient(games: Game[] = buildGames()) {
  fetchGamesResponse = games;
  const result = render(<LibraryClient />);
  // Wait for the initial fetch to complete and loading state to clear
  if (games.length > 0) {
    await waitFor(() => {
      expect(screen.getByTestId(`game-${games[0].id}`)).toBeInTheDocument();
    });
  } else {
    await waitFor(() => {
      expect(screen.getByText(/No games in your library yet/)).toBeInTheDocument();
    });
  }
  return result;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("LibraryClient", () => {
  describe("when games exist", () => {
    it("should render game titles", async () => {
      await renderLibraryClient();
      expect(screen.getByText(TEST_GAME_TITLE)).toBeInTheDocument();
      expect(screen.getByText(SECOND_GAME_TITLE)).toBeInTheDocument();
      expect(screen.getByText(THIRD_GAME_TITLE)).toBeInTheDocument();
    });

    it("should show the active game count", async () => {
      await renderLibraryClient();
      // 2 active (Include + Focus), Skip does not count
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("active")).toBeInTheDocument();
    });
  });

  describe("filter buttons", () => {
    it("should show All, Skip, Lite, Include, Focus filter buttons", async () => {
      await renderLibraryClient();
      expect(screen.getByRole("button", { name: /^All \(3\)$/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Skip \(1\)$/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Lite \(0\)$/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Include \(1\)$/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Focus \(1\)$/ })).toBeInTheDocument();
    });

    it("should filter to only Focus games when Focus is clicked", async () => {
      const user = userEvent.setup();
      await renderLibraryClient();
      const focusButton = screen.getByRole("button", { name: /^Focus \(1\)$/ });
      await user.click(focusButton);
      expect(screen.getByTestId(`game-${THIRD_GAME_ID}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`game-${TEST_GAME_ID}`)).not.toBeInTheDocument();
      expect(screen.queryByTestId(`game-${SECOND_GAME_ID}`)).not.toBeInTheDocument();
    });

    it("should filter to only Skip games when Skip is clicked", async () => {
      const user = userEvent.setup();
      await renderLibraryClient();
      const skipButton = screen.getByRole("button", { name: /^Skip \(1\)$/ });
      await user.click(skipButton);
      expect(screen.getByTestId(`game-${SECOND_GAME_ID}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`game-${TEST_GAME_ID}`)).not.toBeInTheDocument();
    });
  });

  describe("search", () => {
    it("should show the search input", async () => {
      await renderLibraryClient();
      expect(screen.getByPlaceholderText("Search games…")).toBeInTheDocument();
    });

    it("should filter games by title when search is typed", async () => {
      const user = userEvent.setup();
      await renderLibraryClient();
      const searchInput = screen.getByPlaceholderText("Search games…");
      await user.type(searchInput, "Hollow");
      expect(screen.getByTestId(`game-${SECOND_GAME_ID}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`game-${TEST_GAME_ID}`)).not.toBeInTheDocument();
      expect(screen.queryByTestId(`game-${THIRD_GAME_ID}`)).not.toBeInTheDocument();
    });

    it("should show all games when search is cleared", async () => {
      const user = userEvent.setup();
      await renderLibraryClient();
      const searchInput = screen.getByPlaceholderText("Search games…");
      await user.type(searchInput, "Hollow");
      expect(screen.queryByTestId(`game-${TEST_GAME_ID}`)).not.toBeInTheDocument();
      await user.clear(searchInput);
      expect(screen.getByTestId(`game-${TEST_GAME_ID}`)).toBeInTheDocument();
      expect(screen.getByTestId(`game-${SECOND_GAME_ID}`)).toBeInTheDocument();
    });
  });

  describe("when no games match filter", () => {
    it("should show empty state message", async () => {
      const user = userEvent.setup();
      await renderLibraryClient();
      const searchInput = screen.getByPlaceholderText("Search games…");
      await user.type(searchInput, "zzzznonexistent");
      expect(screen.getByText("No games match your filters.")).toBeInTheDocument();
    });
  });

  describe("when library is empty", () => {
    it("should show the empty library message", async () => {
      await renderLibraryClient([]);
      expect(screen.getByText("No games in your library yet.")).toBeInTheDocument();
    });

    it("should auto-expand the catalog browser", async () => {
      await renderLibraryClient([]);
      await waitFor(() => {
        expect(screen.getByTestId("catalog-browser")).toBeInTheDocument();
      });
    });
  });

  describe("catalog section", () => {
    it("should render the Browse Catalog section", async () => {
      await renderLibraryClient();
      expect(screen.getByText("Browse Catalog")).toBeInTheDocument();
    });

    it("should toggle catalog visibility when clicked", async () => {
      const user = userEvent.setup();
      await renderLibraryClient();
      // Catalog starts collapsed when there are games
      expect(screen.queryByTestId("catalog-browser")).not.toBeInTheDocument();
      const catalogButton = screen.getByText("Browse Catalog");
      await user.click(catalogButton);
      expect(screen.getByTestId("catalog-browser")).toBeInTheDocument();
    });
  });
});
