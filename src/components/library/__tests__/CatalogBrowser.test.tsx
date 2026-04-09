// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CurationMode } from "@/types";
import type { Game } from "@/types";
import { OnboardingPhase } from "@/types";

// ─── File-level constants ──────────────────────────────────────────────────

const GAME_HOLLOW_KNIGHT: Game = {
  id: "game-hk",
  title: "Hollow Knight",
  curation: CurationMode.Include,
  steam_appid: 367520,
  onboarding_phase: OnboardingPhase.Tagged,
  published: true,
  tracklist_source: "discogs",
  yt_playlist_id: "PLhk-123",
  thumbnail_url: "https://example.com/hk.jpg",
  needs_review: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const GAME_CELESTE: Game = {
  id: "game-celeste",
  title: "Celeste",
  curation: CurationMode.Include,
  steam_appid: 504230,
  onboarding_phase: OnboardingPhase.Tagged,
  published: true,
  tracklist_source: "discogs",
  yt_playlist_id: "PLhk-456",
  thumbnail_url: "https://example.com/celeste.jpg",
  needs_review: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const CATALOG_GAMES = [GAME_HOLLOW_KNIGHT, GAME_CELESTE];

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    return <img {...props} />;
  },
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

async function importComponent() {
  const mod = await import("../CatalogBrowser");
  return mod.CatalogBrowser;
}

function mockFetchSuccess(data: Game[] = CATALOG_GAMES) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("CatalogBrowser", () => {
  beforeEach(() => {
    globalThis.fetch = mockFetchSuccess();
  });

  describe("when component mounts", () => {
    it("should fetch catalog from /api/games/catalog", async () => {
      const CatalogBrowser = await importComponent();
      render(
        <CatalogBrowser
          requestFormEnabled={false}
          turnstileSiteKey={undefined}
          libraryGameIds={new Set()}
          onAdd={vi.fn()}
          drawerExpanded={true}
          steamFilterOn={false}
          steamMatchedGameIds={[]}
        />,
      );

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith("/api/games/catalog");
      });
    });
  });

  describe("when catalog has games", () => {
    it("should render game titles", async () => {
      const CatalogBrowser = await importComponent();
      render(
        <CatalogBrowser
          requestFormEnabled={false}
          turnstileSiteKey={undefined}
          libraryGameIds={new Set()}
          onAdd={vi.fn()}
          drawerExpanded={true}
          steamFilterOn={false}
          steamMatchedGameIds={[]}
        />,
      );

      expect(await screen.findByText("Hollow Knight")).toBeInTheDocument();
      expect(screen.getByText("Celeste")).toBeInTheDocument();
    });

    it("should not show loading spinner after games load", async () => {
      const CatalogBrowser = await importComponent();
      render(
        <CatalogBrowser
          requestFormEnabled={false}
          turnstileSiteKey={undefined}
          libraryGameIds={new Set()}
          onAdd={vi.fn()}
          drawerExpanded={true}
          steamFilterOn={false}
          steamMatchedGameIds={[]}
        />,
      );

      await screen.findByText("Hollow Knight");
      expect(screen.queryByText("No games found.")).not.toBeInTheDocument();
    });
  });

  describe("when a game is already in library", () => {
    it("should show 'In library' indicator", async () => {
      const CatalogBrowser = await importComponent();
      render(
        <CatalogBrowser
          requestFormEnabled={false}
          turnstileSiteKey={undefined}
          libraryGameIds={new Set(["game-hk"])}
          onAdd={vi.fn()}
          drawerExpanded={true}
          steamFilterOn={false}
          steamMatchedGameIds={[]}
        />,
      );

      await screen.findByText("Hollow Knight");
      expect(screen.getByText("In library")).toBeInTheDocument();
    });

    it("should not show add button for that game", async () => {
      const CatalogBrowser = await importComponent();
      render(
        <CatalogBrowser
          requestFormEnabled={false}
          turnstileSiteKey={undefined}
          libraryGameIds={new Set(["game-hk", "game-celeste"])}
          onAdd={vi.fn()}
          drawerExpanded={true}
          steamFilterOn={false}
          steamMatchedGameIds={[]}
        />,
      );

      await screen.findByText("Hollow Knight");
      expect(screen.queryByText("+ Add")).not.toBeInTheDocument();
    });
  });

  describe("when a game is not in library", () => {
    it("should show add button", async () => {
      const CatalogBrowser = await importComponent();
      render(
        <CatalogBrowser
          requestFormEnabled={false}
          turnstileSiteKey={undefined}
          libraryGameIds={new Set()}
          onAdd={vi.fn()}
          drawerExpanded={true}
          steamFilterOn={false}
          steamMatchedGameIds={[]}
        />,
      );

      await screen.findByText("Hollow Knight");
      const addButtons = screen.getAllByText("+ Add");
      expect(addButtons.length).toBe(2);
    });
  });

  describe("when searchFilter prop is provided", () => {
    it("should filter games client-side by title", async () => {
      const CatalogBrowser = await importComponent();
      render(
        <CatalogBrowser
          requestFormEnabled={false}
          turnstileSiteKey={undefined}
          libraryGameIds={new Set()}
          onAdd={vi.fn()}
          searchFilter="hollow"
          drawerExpanded={true}
          steamFilterOn={false}
          steamMatchedGameIds={[]}
        />,
      );

      expect(await screen.findByText("Hollow Knight")).toBeInTheDocument();
      expect(screen.queryByText("Celeste")).not.toBeInTheDocument();
    });

    it("should show all games when searchFilter is empty", async () => {
      const CatalogBrowser = await importComponent();
      render(
        <CatalogBrowser
          requestFormEnabled={false}
          turnstileSiteKey={undefined}
          libraryGameIds={new Set()}
          onAdd={vi.fn()}
          searchFilter=""
          drawerExpanded={true}
          steamFilterOn={false}
          steamMatchedGameIds={[]}
        />,
      );

      expect(await screen.findByText("Hollow Knight")).toBeInTheDocument();
      expect(screen.getByText("Celeste")).toBeInTheDocument();
    });
  });

  describe("when add button is clicked", () => {
    it("should call onAdd with the game and default curation", async () => {
      const onAdd = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      const CatalogBrowser = await importComponent();
      render(
        <CatalogBrowser
          requestFormEnabled={false}
          turnstileSiteKey={undefined}
          libraryGameIds={new Set()}
          onAdd={onAdd}
          drawerExpanded={true}
          steamFilterOn={false}
          steamMatchedGameIds={[]}
        />,
      );

      await screen.findByText("Hollow Knight");

      const addButtons = screen.getAllByText("+ Add");
      await user.click(addButtons[0]);

      await waitFor(() => {
        expect(onAdd).toHaveBeenCalledWith(GAME_HOLLOW_KNIGHT, CurationMode.Include);
      });
    });

    it("should not propagate when onAdd rejects", async () => {
      const onAdd = vi.fn().mockRejectedValue(new Error("fail"));
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const CatalogBrowser = await importComponent();
      render(
        <CatalogBrowser
          requestFormEnabled={false}
          turnstileSiteKey={undefined}
          libraryGameIds={new Set()}
          onAdd={onAdd}
          drawerExpanded={true}
          steamFilterOn={false}
          steamMatchedGameIds={[]}
        />,
      );

      await screen.findByText("Hollow Knight");

      const addButtons = screen.getAllByText("+ Add");
      await user.click(addButtons[0]);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });
});
