// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

import { GenerateSection } from "../GenerateSection";

// ─── File-level constants ────────────────────────────────────────────────────

const PRESET_25 = 25;
const PRESET_50 = 50;
const PRESET_100 = 100;
const DEFAULT_TRACK_COUNT = 50;
const DEFAULT_GAMES_COUNT = 3;
const PROGRESS_TITLE_A = "Dark Souls";
const PROGRESS_TITLE_B = "Hollow Knight";
const GEN_ERROR_MSG = "Failed to generate playlist.";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function defaultProps() {
  return {
    generating: false,
    genError: null as string | null,
    cooldownUntil: 0,
    targetTrackCount: DEFAULT_TRACK_COUNT,
    onTargetSave: vi.fn(),
    gamesCount: DEFAULT_GAMES_COUNT,
    games: [
      { id: "g1", title: PROGRESS_TITLE_A },
      { id: "g2", title: PROGRESS_TITLE_B },
    ],
    onGenerate: vi.fn(),
    allowLongTracks: false,
    onToggleLongTracks: vi.fn(),
    allowShortTracks: false,
    onToggleShortTracks: vi.fn(),
  };
}

/**
 * Render with fake timers and flush the zero-delay timeout that
 * the component uses to compute `secsLeft` from `cooldownUntil`.
 */
function renderWithTimers(props: ReturnType<typeof defaultProps>): ReturnType<typeof render> {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const result = render(<GenerateSection {...props} />);
  // Flush the setTimeout(…, 0) that sets secsLeft + quip
  act(() => {
    vi.advanceTimersByTime(1);
  });
  return result;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("GenerateSection", () => {
  describe("when in default state", () => {
    it("should show the Generate button", () => {
      render(<GenerateSection {...defaultProps()} />);
      expect(screen.getByRole("button", { name: /curate.*tracks/i })).toBeInTheDocument();
    });

    it("should have the Generate button enabled", () => {
      render(<GenerateSection {...defaultProps()} />);
      expect(screen.getByRole("button", { name: /curate.*tracks/i })).toBeEnabled();
    });
  });

  describe("when gamesCount is 0", () => {
    it("should disable the Generate button", () => {
      render(<GenerateSection {...defaultProps()} gamesCount={0} />);
      expect(screen.getByRole("button", { name: /curate.*tracks/i })).toBeDisabled();
    });
  });

  describe("when generating is true", () => {
    it("should show the Curating… label on the action button", () => {
      render(<GenerateSection {...defaultProps()} generating={true} />);
      expect(screen.getByRole("button", { name: /curating…/i })).toBeInTheDocument();
    });

    it("should disable the action button", () => {
      render(<GenerateSection {...defaultProps()} generating={true} />);
      expect(screen.getByRole("button", { name: /curating…/i })).toBeDisabled();
    });

    it("should render the cycling progress line", () => {
      render(<GenerateSection {...defaultProps()} generating={true} />);
      expect(screen.getByText(/curating from/i)).toBeInTheDocument();
    });
  });

  describe("when Generate button is clicked", () => {
    it("should call onGenerate", async () => {
      const user = userEvent.setup();
      const onGenerate = vi.fn();
      render(<GenerateSection {...defaultProps()} onGenerate={onGenerate} />);

      await user.click(screen.getByRole("button", { name: /curate.*tracks/i }));
      expect(onGenerate).toHaveBeenCalledOnce();
    });
  });

  describe("when genError is set", () => {
    it("should display the error message", () => {
      render(<GenerateSection {...defaultProps()} genError={GEN_ERROR_MSG} />);
      expect(screen.getByText(GEN_ERROR_MSG)).toBeInTheDocument();
    });

    it("should NOT show error when cooldown is active", () => {
      const props = {
        ...defaultProps(),
        genError: GEN_ERROR_MSG,
        cooldownUntil: Date.now() + 60_000,
      };
      renderWithTimers(props);
      expect(screen.queryByText(GEN_ERROR_MSG)).not.toBeInTheDocument();
    });
  });

  describe("when generating with library games", () => {
    it("should display one of the shuffled game titles in the cycling line", () => {
      render(<GenerateSection {...defaultProps()} generating={true} />);
      // The cycling line picks one of the library games to display first
      const displayed =
        screen.queryByText(PROGRESS_TITLE_A) ?? screen.queryByText(PROGRESS_TITLE_B);
      expect(displayed).toBeInTheDocument();
    });
  });

  describe("when preset buttons are clicked", () => {
    it("should call onTargetSave with 25 when the 25 preset is clicked", async () => {
      const user = userEvent.setup();
      const onTargetSave = vi.fn();
      render(<GenerateSection {...defaultProps()} onTargetSave={onTargetSave} />);

      await user.click(screen.getByRole("button", { name: String(PRESET_25) }));
      expect(onTargetSave).toHaveBeenCalledWith(PRESET_25);
    });

    it("should call onTargetSave with 100 when the 100 preset is clicked", async () => {
      const user = userEvent.setup();
      const onTargetSave = vi.fn();
      render(<GenerateSection {...defaultProps()} onTargetSave={onTargetSave} />);

      await user.click(screen.getByRole("button", { name: String(PRESET_100) }));
      expect(onTargetSave).toHaveBeenCalledWith(PRESET_100);
    });

    it("should call onTargetSave even for the already-active preset", async () => {
      const user = userEvent.setup();
      const onTargetSave = vi.fn();
      render(
        <GenerateSection
          {...defaultProps()}
          targetTrackCount={PRESET_50}
          onTargetSave={onTargetSave}
        />,
      );

      await user.click(screen.getByRole("button", { name: String(PRESET_50) }));
      expect(onTargetSave).toHaveBeenCalledWith(PRESET_50);
    });
  });

  describe("when cooldownUntil is in the future", () => {
    it("should disable the Generate button", () => {
      const props = {
        ...defaultProps(),
        cooldownUntil: Date.now() + 60_000,
      };
      renderWithTimers(props);
      // After timers flush, secsLeft > 0 so the button text changes to a
      // cooldown quip and the button is disabled. Find it by its bg-primary
      // class (the main action button).
      const actionButtons = screen.getAllByRole("button");
      const generateBtn = actionButtons.find((btn) => btn.className.includes("bg-primary"));
      expect(generateBtn).toBeDefined();
      expect(generateBtn).toBeDisabled();
    });
  });
});
