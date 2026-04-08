// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { Game } from "@/types";
import { CurationMode, OnboardingPhase } from "@/types";

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockPlayerContext = {
  gameLibrary: { games: [] as Game[] },
  config: {
    targetTrackCount: 50,
    allowLongTracks: false,
    allowShortTracks: false,
    rawVibes: false,
    saveTrackCount: vi.fn(),
    saveAllowLongTracks: vi.fn(),
    saveAllowShortTracks: vi.fn(),
    saveRawVibes: vi.fn(),
  },
  playlist: {
    cooldownUntil: 0,
    generating: false,
    genError: null as string | null,
  },
};

vi.mock("@/context/player-context", () => ({
  usePlayerContext: () => mockPlayerContext,
}));

vi.mock("@/hooks/shared/useCooldownTimer", () => ({
  useCooldownTimer: () => ({ secsLeft: 0, quip: "" }),
}));

import { Launchpad } from "../Launchpad";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockPlayerContext.gameLibrary.games = [];
  mockPlayerContext.config.targetTrackCount = 50;
  mockPlayerContext.config.allowLongTracks = false;
  mockPlayerContext.config.allowShortTracks = false;
  mockPlayerContext.config.rawVibes = false;
  mockPlayerContext.playlist.cooldownUntil = 0;
  mockPlayerContext.playlist.generating = false;
  mockPlayerContext.playlist.genError = null;
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: `g-${Math.random().toString(36).slice(2, 8)}`,
    title: "Hollow Knight",
    curation: CurationMode.Include,
    steam_appid: null,
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

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Launchpad", () => {
  describe("when library is empty", () => {
    it("should render the no-library copy", () => {
      render(<Launchpad pressedCurate={false} onCurateClick={vi.fn()} />);
      expect(
        screen.getByText(/add games from the catalog to build your first playlist/i),
      ).toBeInTheDocument();
    });

    it("should render the Browse catalog link", () => {
      render(<Launchpad pressedCurate={false} onCurateClick={vi.fn()} />);
      const link = screen.getByRole("link", { name: /browse catalog/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/catalog");
    });

    it("should not render the Curate button", () => {
      render(<Launchpad pressedCurate={false} onCurateClick={vi.fn()} />);
      expect(screen.queryByRole("button", { name: /curate/i })).not.toBeInTheDocument();
    });
  });

  describe("when library has games", () => {
    it("should render the metadata line with the game count only", () => {
      mockPlayerContext.gameLibrary.games = [makeGame(), makeGame()];
      render(<Launchpad pressedCurate={false} onCurateClick={vi.fn()} />);
      expect(screen.getByText("2 games")).toBeInTheDocument();
    });

    it("should render singular 'game' for one game", () => {
      mockPlayerContext.gameLibrary.games = [makeGame()];
      render(<Launchpad pressedCurate={false} onCurateClick={vi.fn()} />);
      expect(screen.getByText("1 game")).toBeInTheDocument();
    });

    it("should render the Add games escape link", () => {
      mockPlayerContext.gameLibrary.games = [makeGame()];
      render(<Launchpad pressedCurate={false} onCurateClick={vi.fn()} />);
      const link = screen.getByRole("link", { name: /add games/i });
      expect(link).toHaveAttribute("href", "/catalog");
    });

    it("should render the Curate button with the target track count", () => {
      mockPlayerContext.gameLibrary.games = [makeGame()];
      mockPlayerContext.config.targetTrackCount = 25;
      render(<Launchpad pressedCurate={false} onCurateClick={vi.fn()} />);
      expect(screen.getByRole("button", { name: /curate 25 tracks/i })).toBeInTheDocument();
    });

    it("should call onCurateClick when Curate is pressed", () => {
      const onCurateClick = vi.fn();
      mockPlayerContext.gameLibrary.games = [makeGame()];
      render(<Launchpad pressedCurate={false} onCurateClick={onCurateClick} />);
      fireEvent.click(screen.getByRole("button", { name: /curate/i }));
      expect(onCurateClick).toHaveBeenCalledTimes(1);
    });

    it("should call saveTrackCount when a size preset is clicked", () => {
      mockPlayerContext.gameLibrary.games = [makeGame()];
      render(<Launchpad pressedCurate={false} onCurateClick={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: "100" }));
      expect(mockPlayerContext.config.saveTrackCount).toHaveBeenCalledWith(100);
    });

    it("should render the Advanced toggle in place of long/short labels", () => {
      mockPlayerContext.gameLibrary.games = [makeGame()];
      render(<Launchpad pressedCurate={false} onCurateClick={vi.fn()} />);
      expect(screen.getByRole("button", { name: /advanced/i })).toBeInTheDocument();
    });

    it("should hide the Advanced area until the Advanced toggle is opened", () => {
      mockPlayerContext.gameLibrary.games = [makeGame()];
      render(<Launchpad pressedCurate={false} onCurateClick={vi.fn()} />);
      // Advanced area is mounted but aria-hidden when closed
      const customInput = screen.queryByLabelText(/custom playlist size/i);
      expect(customInput?.closest("[aria-hidden]")).toHaveAttribute("aria-hidden", "true");
    });

    it("should reveal Custom + Long/Short/Raw rows when Advanced is clicked", () => {
      mockPlayerContext.gameLibrary.games = [makeGame()];
      render(<Launchpad pressedCurate={false} onCurateClick={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /advanced/i }));
      const region = screen.getByLabelText(/custom playlist size/i).closest("[aria-hidden]");
      expect(region).toHaveAttribute("aria-hidden", "false");
      expect(screen.getByRole("button", { name: /long tracks/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /short tracks/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /raw vibes/i })).toBeInTheDocument();
    });

    it("should call saveAllowLongTracks when Long tracks row is clicked", () => {
      mockPlayerContext.gameLibrary.games = [makeGame()];
      render(<Launchpad pressedCurate={false} onCurateClick={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /advanced/i }));
      fireEvent.click(screen.getByRole("button", { name: /long tracks/i }));
      expect(mockPlayerContext.config.saveAllowLongTracks).toHaveBeenCalledWith(true);
    });

    it("should call saveAllowShortTracks when Short tracks row is clicked", () => {
      mockPlayerContext.gameLibrary.games = [makeGame()];
      render(<Launchpad pressedCurate={false} onCurateClick={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /advanced/i }));
      fireEvent.click(screen.getByRole("button", { name: /short tracks/i }));
      expect(mockPlayerContext.config.saveAllowShortTracks).toHaveBeenCalledWith(true);
    });

    it("should call saveRawVibes when Raw vibes row is clicked", () => {
      mockPlayerContext.gameLibrary.games = [makeGame()];
      render(<Launchpad pressedCurate={false} onCurateClick={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /advanced/i }));
      fireEvent.click(screen.getByRole("button", { name: /raw vibes/i }));
      expect(mockPlayerContext.config.saveRawVibes).toHaveBeenCalledWith(true);
    });

    it("should call saveTrackCount when the Custom size input changes", () => {
      mockPlayerContext.gameLibrary.games = [makeGame()];
      render(<Launchpad pressedCurate={false} onCurateClick={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /advanced/i }));
      const input = screen.getByLabelText(/custom playlist size/i);
      fireEvent.change(input, { target: { value: "75" } });
      expect(mockPlayerContext.config.saveTrackCount).toHaveBeenCalledWith(75);
    });

    it("should cap the cover row at 6 covers and show a +N indicator", () => {
      mockPlayerContext.gameLibrary.games = Array.from({ length: 12 }, (_, i) =>
        makeGame({ id: `g-${i}`, title: `Game ${i}` }),
      );
      render(<Launchpad pressedCurate={false} onCurateClick={vi.fn()} />);
      expect(screen.getByText("+6")).toBeInTheDocument();
    });

    it("should not show the +N indicator when there are 6 or fewer games", () => {
      mockPlayerContext.gameLibrary.games = Array.from({ length: 6 }, (_, i) =>
        makeGame({ id: `g-${i}`, title: `Game ${i}` }),
      );
      render(<Launchpad pressedCurate={false} onCurateClick={vi.fn()} />);
      expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
    });
  });

  describe("when pressedCurate is true", () => {
    it("should swap the button label to 'Curating…'", () => {
      mockPlayerContext.gameLibrary.games = [makeGame()];
      render(<Launchpad pressedCurate={true} onCurateClick={vi.fn()} />);
      expect(screen.getByRole("button", { name: /curating/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /curate 50 tracks/i })).not.toBeInTheDocument();
    });

    it("should disable the Curate button", () => {
      mockPlayerContext.gameLibrary.games = [makeGame()];
      render(<Launchpad pressedCurate={true} onCurateClick={vi.fn()} />);
      expect(screen.getByRole("button", { name: /curating/i })).toBeDisabled();
    });
  });

  describe("when generation has an error", () => {
    it("should render the inline error message", () => {
      mockPlayerContext.gameLibrary.games = [makeGame()];
      mockPlayerContext.playlist.genError = "Couldn't generate playlist. Try again.";
      render(<Launchpad pressedCurate={false} onCurateClick={vi.fn()} />);
      expect(screen.getByText(/couldn't generate playlist/i)).toBeInTheDocument();
    });
  });
});
