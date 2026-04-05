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
import { GameProgressStatus } from "@/types";
import type { GameProgressEntry } from "@/hooks/player/usePlaylist";

// ─── File-level constants ────────────────────────────────────────────────────

const PRESET_25 = 25;
const PRESET_50 = 50;
const PRESET_100 = 100;
const DEFAULT_TRACK_COUNT = 50;
const DEFAULT_GAMES_COUNT = 3;
const PROGRESS_TITLE_A = "Dark Souls";
const PROGRESS_TITLE_B = "Hollow Knight";
const GEN_ERROR_MSG = "Failed to generate playlist.";
const IMPORT_ERROR_MSG = "Invalid YouTube URL.";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function defaultProps() {
  return {
    generating: false,
    genProgress: [] as GameProgressEntry[],
    genGlobalMsg: "",
    genError: null as string | null,
    cooldownUntil: 0,
    targetTrackCount: DEFAULT_TRACK_COUNT,
    onTargetChange: vi.fn(),
    onTargetSave: vi.fn(),
    gamesCount: DEFAULT_GAMES_COUNT,
    onGenerate: vi.fn(),
    allowLongTracks: false,
    onToggleLongTracks: vi.fn(),
    allowShortTracks: false,
    onToggleShortTracks: vi.fn(),
    rawVibes: false,
    onToggleRawVibes: vi.fn(),
    isSignedIn: true,
    skipLlm: false,
    onToggleSkipLlm: vi.fn(),
    llmCapReached: false,
    importUrl: "",
    onImportUrlChange: vi.fn(),
    importing: false,
    importError: null as string | null,
    onImport: vi.fn(),
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

    it("should show the game count and track count summary", () => {
      render(<GenerateSection {...defaultProps()} />);
      expect(
        screen.getByText(`${DEFAULT_GAMES_COUNT} games`, { exact: false }),
      ).toBeInTheDocument();
    });
  });

  describe("when gamesCount is 0", () => {
    it("should disable the Generate button", () => {
      render(<GenerateSection {...defaultProps()} gamesCount={0} />);
      expect(screen.getByRole("button", { name: /curate.*tracks/i })).toBeDisabled();
    });

    it("should show the empty library message", () => {
      render(<GenerateSection {...defaultProps()} gamesCount={0} />);
      expect(screen.getByText(/add games to your library/i)).toBeInTheDocument();
    });
  });

  describe("when generating is true", () => {
    it("should hide the Generate control card", () => {
      render(<GenerateSection {...defaultProps()} generating={true} />);
      // The generate card wrapper gets overflow-hidden + opacity-0 when
      // generating is true (showGenerate = false). The button is still in
      // the DOM but the panel is visually collapsed.
      const button = screen.getByRole("button", { name: /curate.*tracks/i });
      const hiddenWrapper = button.closest("[class*='overflow-hidden']");
      expect(hiddenWrapper).toBeInTheDocument();
      expect(hiddenWrapper).toHaveClass("opacity-0");
    });

    it("should show the progress panel", () => {
      render(<GenerateSection {...defaultProps()} generating={true} />);
      expect(screen.getByText(/curating your playlist/i)).toBeInTheDocument();
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

  describe("when genProgress has entries", () => {
    it("should display progress item titles", () => {
      const progress: GameProgressEntry[] = [
        {
          id: "g1",
          title: PROGRESS_TITLE_A,
          status: GameProgressStatus.Active,
          message: "Fetching tracks...",
        },
        {
          id: "g2",
          title: PROGRESS_TITLE_B,
          status: GameProgressStatus.Waiting,
          message: "",
        },
      ];
      render(<GenerateSection {...defaultProps()} generating={true} genProgress={progress} />);
      expect(screen.getByText(PROGRESS_TITLE_A)).toBeInTheDocument();
      expect(screen.getByText(PROGRESS_TITLE_B)).toBeInTheDocument();
    });

    it("should display the active entry's message", () => {
      const progress: GameProgressEntry[] = [
        {
          id: "g1",
          title: PROGRESS_TITLE_A,
          status: GameProgressStatus.Active,
          message: "Fetching tracks...",
        },
      ];
      render(<GenerateSection {...defaultProps()} generating={true} genProgress={progress} />);
      expect(screen.getByText("Fetching tracks...")).toBeInTheDocument();
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

  describe("when in import mode", () => {
    async function switchToImportMode(user: ReturnType<typeof userEvent.setup>) {
      // The link reads "Import from YouTube →" (with arrow)
      await user.click(screen.getByText("Import from YouTube →"));
    }

    it("should show the import form with URL input and submit button", async () => {
      const user = userEvent.setup();
      render(<GenerateSection {...defaultProps()} />);

      await switchToImportMode(user);

      expect(screen.getByPlaceholderText(/youtube playlist url/i)).toBeInTheDocument();
      // The submit button inside the form (type="submit")
      const submitBtn = screen.getByRole("button", { name: /import from youtube$/i });
      expect(submitBtn).toBeInTheDocument();
      expect(submitBtn).toHaveAttribute("type", "submit");
    });

    it("should show the back button to return to generate mode", async () => {
      const user = userEvent.setup();
      render(<GenerateSection {...defaultProps()} />);

      await switchToImportMode(user);
      expect(screen.getByText(/back to curate/i)).toBeInTheDocument();
    });

    it("should collapse the Generate control card", async () => {
      const user = userEvent.setup();
      render(<GenerateSection {...defaultProps()} />);

      await switchToImportMode(user);
      // The generate card wrapper gets overflow-hidden + opacity-0
      const button = screen.getByRole("button", { name: /curate.*tracks/i });
      const hiddenWrapper = button.closest("[class*='overflow-hidden']");
      expect(hiddenWrapper).toBeInTheDocument();
      expect(hiddenWrapper).toHaveClass("opacity-0");
    });
  });

  describe("when importError is set", () => {
    it("should display the import error message in import mode", async () => {
      const user = userEvent.setup();
      render(<GenerateSection {...defaultProps()} importError={IMPORT_ERROR_MSG} />);

      // Switch to import mode to see the import error
      await user.click(screen.getByText("Import from YouTube →"));
      expect(screen.getByText(IMPORT_ERROR_MSG)).toBeInTheDocument();
    });

    it("should NOT show import error in generate mode", () => {
      render(<GenerateSection {...defaultProps()} importError={IMPORT_ERROR_MSG} />);
      // In generate mode, import errors are not rendered
      expect(screen.queryByText(IMPORT_ERROR_MSG)).not.toBeInTheDocument();
    });
  });
});
