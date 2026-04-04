// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaylistEmptyState } from "../PlaylistEmptyState";
import type { SyntheticEvent } from "react";

afterEach(() => {
  cleanup();
});

function renderEmptyState(
  overrides: Partial<{
    gamesLength: number;
    importUrl: string;
    onImportUrlChange: (url: string) => void;
    importing: boolean;
    importError: string | null;
    onImport: (e: SyntheticEvent<HTMLFormElement>) => void;
  }> = {},
) {
  const props = {
    gamesLength: 0,
    importUrl: "",
    onImportUrlChange: vi.fn(),
    importing: false,
    importError: null,
    onImport: vi.fn((e: SyntheticEvent<HTMLFormElement>) => e.preventDefault()),
    ...overrides,
  };
  return { ...render(<PlaylistEmptyState {...props} />), props };
}

describe("PlaylistEmptyState", () => {
  describe("when gamesLength is 0", () => {
    it("should show library-building message", () => {
      renderEmptyState({ gamesLength: 0 });
      expect(screen.getByText(/add games to your library/i)).toBeInTheDocument();
    });

    it("should show 'Browse catalog' CTA link", () => {
      renderEmptyState({ gamesLength: 0 });
      expect(screen.getByRole("link", { name: /browse catalog/i })).toBeInTheDocument();
    });
  });

  describe("when gamesLength is greater than 0", () => {
    it("should show 'Hit Curate' message", () => {
      renderEmptyState({ gamesLength: 3 });
      expect(screen.getByText(/hit curate/i)).toBeInTheDocument();
    });

    it("should not show 'Build Your Library' CTA link", () => {
      renderEmptyState({ gamesLength: 3 });
      expect(screen.queryByRole("link", { name: /build your library/i })).not.toBeInTheDocument();
    });
  });

  it("should show import URL input and submit button", () => {
    renderEmptyState();
    expect(screen.getByPlaceholderText(/paste a youtube playlist url/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import from youtube/i })).toBeInTheDocument();
  });

  describe("when importing is true", () => {
    it("should disable input and show 'Importing\u2026'", () => {
      renderEmptyState({ importing: true });
      expect(screen.getByPlaceholderText(/paste a youtube playlist url/i)).toBeDisabled();
      expect(screen.getByText("Importing\u2026")).toBeInTheDocument();
    });
  });

  describe("when importError is set", () => {
    it("should display error message", () => {
      renderEmptyState({ importError: "Invalid playlist URL" });
      expect(screen.getByText("Invalid playlist URL")).toBeInTheDocument();
    });
  });

  describe("when import URL is empty", () => {
    it("should disable the submit button", () => {
      renderEmptyState({ importUrl: "" });
      expect(screen.getByRole("button", { name: /import from youtube/i })).toBeDisabled();
    });
  });

  describe("when URL is entered and submitted", () => {
    it("should call onImport", async () => {
      const onImport = vi.fn((e: SyntheticEvent<HTMLFormElement>) => e.preventDefault());
      renderEmptyState({
        importUrl: "https://youtube.com/playlist?list=PLabc",
        onImport,
      });

      await userEvent.click(screen.getByRole("button", { name: /import from youtube/i }));
      expect(onImport).toHaveBeenCalled();
    });
  });
});
