// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CurationMode } from "@/types";
import type { Game } from "@/types";
import { OnboardingPhase } from "@/types";

// ─── File-level constants ──────────────────────────────────────────────────

const BASE_GAME: Game = {
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
  ...BASE_GAME,
  id: "game-celeste",
  title: "Celeste",
  steam_appid: 504230,
};

const GAME_FOCUS: Game = {
  ...BASE_GAME,
  id: "game-focus",
  title: "Focus Game",
  curation: CurationMode.Focus,
};

const GAME_LITE: Game = {
  ...BASE_GAME,
  id: "game-lite",
  title: "Lite Game",
  curation: CurationMode.Lite,
};

const GAME_NO_STEAM: Game = {
  ...BASE_GAME,
  id: "game-no-steam",
  title: "Xenoblade",
  steam_appid: null,
};

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/constants", () => ({
  steamHeaderUrl: (appid: number) =>
    `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

async function importComponent() {
  const mod = await import("../LibraryDrawer");
  return mod.LibraryDrawer;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("LibraryDrawer", () => {
  describe("when library is empty", () => {
    it("should show empty state message", async () => {
      const LibraryDrawer = await importComponent();
      render(
        <LibraryDrawer
          games={[]}
          targetTrackCount={50}
          generating={false}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onGenerate={vi.fn()}
        />,
      );

      expect(screen.getByText("Your library is empty")).toBeInTheDocument();
      expect(
        screen.getByText("Add a few soundtracks from the catalog to start your first session."),
      ).toBeInTheDocument();
    });

    it("should not show the generate footer", async () => {
      const LibraryDrawer = await importComponent();
      render(
        <LibraryDrawer
          games={[]}
          targetTrackCount={50}
          generating={false}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onGenerate={vi.fn()}
        />,
      );

      expect(screen.queryByText("Curate 50 Tracks")).not.toBeInTheDocument();
    });
  });

  describe("when library has games", () => {
    it("should render game titles", async () => {
      const LibraryDrawer = await importComponent();
      render(
        <LibraryDrawer
          games={[BASE_GAME, GAME_CELESTE]}
          targetTrackCount={50}
          generating={false}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onGenerate={vi.fn()}
        />,
      );

      expect(screen.getByText("Hollow Knight")).toBeInTheDocument();
      expect(screen.getByText("Celeste")).toBeInTheDocument();
    });

    it("should show game count in header", async () => {
      const LibraryDrawer = await importComponent();
      render(
        <LibraryDrawer
          games={[BASE_GAME, GAME_CELESTE]}
          targetTrackCount={50}
          generating={false}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onGenerate={vi.fn()}
        />,
      );

      // Game count "2" renders in both the collapsed strip (vertical text) and the
      // expanded header — both are in the DOM (the strip is just opacity-faded when
      // expanded). Assert at least one is present.
      expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
    });

    it("should show steam thumbnail for games with steam_appid", async () => {
      const LibraryDrawer = await importComponent();
      render(
        <LibraryDrawer
          games={[BASE_GAME]}
          targetTrackCount={50}
          generating={false}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onGenerate={vi.fn()}
        />,
      );

      const img = screen.getByAltText("Hollow Knight");
      expect(img).toHaveAttribute(
        "src",
        "https://cdn.akamai.steamstatic.com/steam/apps/367520/header.jpg",
      );
    });

    it("should show initial letter fallback for games without steam_appid", async () => {
      const LibraryDrawer = await importComponent();
      render(
        <LibraryDrawer
          games={[GAME_NO_STEAM]}
          targetTrackCount={50}
          generating={false}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onGenerate={vi.fn()}
        />,
      );

      expect(screen.getByText("X")).toBeInTheDocument();
    });
  });

  describe("curation badge cycling", () => {
    // The tooltip content also renders "Focus", "Include", "Lite" text,
    // so we target the curation badge <button> elements specifically.
    function getCurationBadgeButton(label: string): HTMLElement {
      const allMatches = screen.getAllByText(label);
      const badge = allMatches.find((el) => el.tagName === "BUTTON");
      if (!badge) throw new Error(`No <button> found with text "${label}"`);
      return badge;
    }

    it("should cycle Focus -> Include on click", async () => {
      const onCurationChange = vi.fn();
      const user = userEvent.setup();
      const LibraryDrawer = await importComponent();

      render(
        <LibraryDrawer
          games={[GAME_FOCUS]}
          targetTrackCount={50}
          generating={false}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={onCurationChange}
          onRemove={vi.fn()}
          onGenerate={vi.fn()}
        />,
      );

      await user.click(getCurationBadgeButton("Focus"));
      expect(onCurationChange).toHaveBeenCalledWith("game-focus", CurationMode.Include);
    });

    it("should cycle Include -> Lite on click", async () => {
      const onCurationChange = vi.fn();
      const user = userEvent.setup();
      const LibraryDrawer = await importComponent();

      render(
        <LibraryDrawer
          games={[BASE_GAME]}
          targetTrackCount={50}
          generating={false}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={onCurationChange}
          onRemove={vi.fn()}
          onGenerate={vi.fn()}
        />,
      );

      await user.click(getCurationBadgeButton("Include"));
      expect(onCurationChange).toHaveBeenCalledWith("game-hk", CurationMode.Lite);
    });

    it("should cycle Lite -> Focus on click", async () => {
      const onCurationChange = vi.fn();
      const user = userEvent.setup();
      const LibraryDrawer = await importComponent();

      render(
        <LibraryDrawer
          games={[GAME_LITE]}
          targetTrackCount={50}
          generating={false}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={onCurationChange}
          onRemove={vi.fn()}
          onGenerate={vi.fn()}
        />,
      );

      await user.click(getCurationBadgeButton("Lite"));
      expect(onCurationChange).toHaveBeenCalledWith("game-lite", CurationMode.Focus);
    });
  });

  describe("remove button", () => {
    it("should call onRemove with game id when clicked", async () => {
      const onRemove = vi.fn();
      const user = userEvent.setup();
      const LibraryDrawer = await importComponent();

      render(
        <LibraryDrawer
          games={[BASE_GAME]}
          targetTrackCount={50}
          generating={false}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={onRemove}
          onGenerate={vi.fn()}
        />,
      );

      // The remove button is the only one matching its X-icon path data.
      const removePath = document.querySelector('path[d^="M6.28 5.22"]');
      expect(removePath).not.toBeNull();
      const removeButton = removePath!.closest("button");
      expect(removeButton).not.toBeNull();
      await user.click(removeButton!);

      expect(onRemove).toHaveBeenCalledWith("game-hk");
    });
  });

  describe("footer", () => {
    it("should show active game count and track count", async () => {
      const LibraryDrawer = await importComponent();
      render(
        <LibraryDrawer
          games={[BASE_GAME, GAME_CELESTE]}
          targetTrackCount={50}
          generating={false}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onGenerate={vi.fn()}
        />,
      );

      expect(screen.getByText("2 games")).toBeInTheDocument();
      expect(screen.getByText("50 tracks")).toBeInTheDocument();
    });

    it("should use singular 'game' when only one active game", async () => {
      const LibraryDrawer = await importComponent();
      render(
        <LibraryDrawer
          games={[BASE_GAME]}
          targetTrackCount={30}
          generating={false}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onGenerate={vi.fn()}
        />,
      );

      expect(screen.getByText("1 game")).toBeInTheDocument();
      expect(screen.getByText("30 tracks")).toBeInTheDocument();
    });
  });

  describe("generate button", () => {
    it("should show track count in button text", async () => {
      const LibraryDrawer = await importComponent();
      render(
        <LibraryDrawer
          games={[BASE_GAME]}
          targetTrackCount={50}
          generating={false}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onGenerate={vi.fn()}
        />,
      );

      expect(screen.getByText("Curate 50 Tracks")).toBeInTheDocument();
    });

    it("should call onGenerate when clicked", async () => {
      const onGenerate = vi.fn();
      const user = userEvent.setup();
      const LibraryDrawer = await importComponent();

      render(
        <LibraryDrawer
          games={[BASE_GAME]}
          targetTrackCount={50}
          generating={false}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onGenerate={onGenerate}
        />,
      );

      await user.click(screen.getByText("Curate 50 Tracks"));
      expect(onGenerate).toHaveBeenCalledOnce();
    });

    it("should be disabled and show loading text when generating", async () => {
      const onGenerate = vi.fn();
      const user = userEvent.setup();
      const LibraryDrawer = await importComponent();

      render(
        <LibraryDrawer
          games={[BASE_GAME]}
          targetTrackCount={50}
          generating={true}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onGenerate={onGenerate}
        />,
      );

      const button = screen.getByText("Curating\u2026");
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();

      await user.click(button);
      expect(onGenerate).not.toHaveBeenCalled();
    });
  });
});
