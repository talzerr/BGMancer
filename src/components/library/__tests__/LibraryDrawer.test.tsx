// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
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

const GAME_NO_THUMBNAIL: Game = {
  ...BASE_GAME,
  id: "game-no-thumbnail",
  title: "Xenoblade",
  steam_appid: null,
  thumbnail_url: null,
};

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

// Mock the Popover primitive as a controlled wrapper that conditionally renders
// its content. This lets us assert against popover contents without booting
// base-ui's portal/positioning layer in jsdom.
const PopoverCtx = React.createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
}>({ open: false, setOpen: () => {} });

vi.mock("@/components/ui/popover", () => {
  return {
    Popover: ({
      children,
      open,
      onOpenChange,
    }: {
      children: React.ReactNode;
      open?: boolean;
      onOpenChange?: (v: boolean) => void;
    }) => {
      const [internalOpen, setInternalOpen] = React.useState(false);
      const isControlled = open !== undefined;
      const isOpen = isControlled ? !!open : internalOpen;
      const setOpen = (v: boolean) => {
        if (!isControlled) setInternalOpen(v);
        onOpenChange?.(v);
      };
      return (
        <PopoverCtx.Provider value={{ open: isOpen, setOpen }}>{children}</PopoverCtx.Provider>
      );
    },
    PopoverTrigger: ({
      children,
      className,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
      const { setOpen } = React.useContext(PopoverCtx);
      return (
        <button type="button" className={className} onClick={() => setOpen(true)} {...props}>
          {children}
        </button>
      );
    },
    PopoverContent: ({ children }: { children: React.ReactNode }) => {
      const { open } = React.useContext(PopoverCtx);
      return open ? <div data-testid="popover-content">{children}</div> : null;
    },
  };
});

vi.mock("@/lib/constants", () => ({
  steamHeaderUrl: (appid: number) =>
    `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`,
  LIBRARY_MAX_GAMES: 25,
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
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onCurate={vi.fn()}
        />,
      );

      expect(screen.getByText("Your library is empty")).toBeInTheDocument();
      expect(
        screen.getByText("Add a few soundtracks from the catalog to start your first session."),
      ).toBeInTheDocument();
    });
  });

  describe("when library has games", () => {
    it("should render game titles", async () => {
      const LibraryDrawer = await importComponent();
      render(
        <LibraryDrawer
          games={[BASE_GAME, GAME_CELESTE]}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onCurate={vi.fn()}
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
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onCurate={vi.fn()}
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
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onCurate={vi.fn()}
        />,
      );

      const img = screen.getByAltText("Hollow Knight");
      expect(img).toHaveAttribute(
        "src",
        "https://cdn.akamai.steamstatic.com/steam/apps/367520/header.jpg",
      );
    });

    it("should fall back to thumbnail_url for games without steam_appid", async () => {
      const LibraryDrawer = await importComponent();
      render(
        <LibraryDrawer
          games={[GAME_NO_STEAM]}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onCurate={vi.fn()}
        />,
      );

      const img = screen.getByAltText("Xenoblade");
      expect(img).toHaveAttribute("src", "https://example.com/hk.jpg");
    });

    it("should show initial letter fallback when both steam_appid and thumbnail_url are missing", async () => {
      const LibraryDrawer = await importComponent();
      render(
        <LibraryDrawer
          games={[GAME_NO_THUMBNAIL]}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onCurate={vi.fn()}
        />,
      );

      expect(screen.getByText("X")).toBeInTheDocument();
    });
  });

  describe("row label", () => {
    it("should render lowercase 'focus' label for Focus mode", async () => {
      const LibraryDrawer = await importComponent();
      render(
        <LibraryDrawer
          games={[GAME_FOCUS]}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onCurate={vi.fn()}
        />,
      );
      expect(screen.getByText("focus")).toBeInTheDocument();
    });

    it("should render lowercase 'lite' label for Lite mode", async () => {
      const LibraryDrawer = await importComponent();
      render(
        <LibraryDrawer
          games={[GAME_LITE]}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onCurate={vi.fn()}
        />,
      );
      expect(screen.getByText("lite")).toBeInTheDocument();
    });

    it("should render no curation label for Include mode", async () => {
      const LibraryDrawer = await importComponent();
      render(
        <LibraryDrawer
          games={[BASE_GAME]}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onCurate={vi.fn()}
        />,
      );
      expect(screen.queryByText("focus")).not.toBeInTheDocument();
      expect(screen.queryByText("lite")).not.toBeInTheDocument();
    });
  });

  describe("row popover", () => {
    function renderWith(game: Game) {
      const onCurationChange = vi.fn();
      const onRemove = vi.fn();
      return {
        onCurationChange,
        onRemove,
        async open() {
          const LibraryDrawer = await importComponent();
          render(
            <LibraryDrawer
              games={[game]}
              isExpanded={true}
              onExpandedChange={vi.fn()}
              onCurationChange={onCurationChange}
              onRemove={onRemove}
              onCurate={vi.fn()}
            />,
          );
          const user = userEvent.setup();
          // Open the popover by clicking the row trigger.
          await user.click(screen.getByRole("button", { name: `Configure ${game.title}` }));
          return user;
        },
      };
    }

    it("should open popover with all three mode options when row is clicked", async () => {
      const ctx = renderWith(BASE_GAME);
      await ctx.open();

      const popover = screen.getByTestId("popover-content");
      expect(popover).toBeInTheDocument();
      expect(within(popover).getByText("Focus")).toBeInTheDocument();
      expect(within(popover).getByText("Include")).toBeInTheDocument();
      expect(within(popover).getByText("Lite")).toBeInTheDocument();
      expect(within(popover).getByText("Featured in the playlist")).toBeInTheDocument();
      expect(within(popover).getByText("Mixed in naturally (default)")).toBeInTheDocument();
      expect(within(popover).getByText("Light presence")).toBeInTheDocument();
      expect(within(popover).getByText("Remove")).toBeInTheDocument();
    });

    it("should call onCurationChange and close popover when a non-selected mode is picked", async () => {
      const ctx = renderWith(BASE_GAME);
      const user = await ctx.open();

      const popover = screen.getByTestId("popover-content");
      await user.click(within(popover).getByText("Focus"));

      expect(ctx.onCurationChange).toHaveBeenCalledWith("game-hk", CurationMode.Focus);
      expect(screen.queryByTestId("popover-content")).not.toBeInTheDocument();
    });

    it("should not call onCurationChange when current mode is re-selected", async () => {
      const ctx = renderWith(BASE_GAME); // Include
      const user = await ctx.open();

      const popover = screen.getByTestId("popover-content");
      await user.click(within(popover).getByText("Include"));

      expect(ctx.onCurationChange).not.toHaveBeenCalled();
      // Popover still closes.
      expect(screen.queryByTestId("popover-content")).not.toBeInTheDocument();
    });

    it("should call onRemove and close popover when Remove is clicked", async () => {
      const ctx = renderWith(BASE_GAME);
      const user = await ctx.open();

      const popover = screen.getByTestId("popover-content");
      await user.click(within(popover).getByText("Remove"));

      expect(ctx.onRemove).toHaveBeenCalledWith("game-hk");
      expect(screen.queryByTestId("popover-content")).not.toBeInTheDocument();
    });
  });

  describe("header Curate button", () => {
    it("should be disabled when the library is empty", async () => {
      const LibraryDrawer = await importComponent();
      render(
        <LibraryDrawer
          games={[]}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onCurate={vi.fn()}
        />,
      );

      const button = screen.getByRole("button", { name: /curate/i });
      expect(button).toBeDisabled();
    });

    it("should be enabled when the library has games", async () => {
      const LibraryDrawer = await importComponent();
      render(
        <LibraryDrawer
          games={[BASE_GAME]}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onCurate={vi.fn()}
        />,
      );

      const button = screen.getByRole("button", { name: /curate/i });
      expect(button).not.toBeDisabled();
    });

    it("should call onCurate when clicked", async () => {
      const onCurate = vi.fn();
      const user = userEvent.setup();
      const LibraryDrawer = await importComponent();

      render(
        <LibraryDrawer
          games={[BASE_GAME]}
          isExpanded={true}
          onExpandedChange={vi.fn()}
          onCurationChange={vi.fn()}
          onRemove={vi.fn()}
          onCurate={onCurate}
        />,
      );

      await user.click(screen.getByRole("button", { name: /curate/i }));
      expect(onCurate).toHaveBeenCalledOnce();
    });
  });
});
