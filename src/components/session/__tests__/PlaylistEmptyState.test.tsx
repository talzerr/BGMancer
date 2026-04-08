// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PlaylistEmptyState } from "../PlaylistEmptyState";

afterEach(() => {
  cleanup();
});

describe("PlaylistEmptyState", () => {
  describe("when gamesLength is 0", () => {
    it("should show library-building message", () => {
      render(<PlaylistEmptyState gamesLength={0} />);
      expect(screen.getByText(/add games to your library/i)).toBeInTheDocument();
    });

    it("should show 'Browse catalog' CTA link", () => {
      render(<PlaylistEmptyState gamesLength={0} />);
      expect(screen.getByRole("link", { name: /browse catalog/i })).toBeInTheDocument();
    });
  });

  describe("when gamesLength is greater than 0", () => {
    it("should show 'Hit Curate' message", () => {
      render(<PlaylistEmptyState gamesLength={3} />);
      expect(screen.getByText(/hit curate/i)).toBeInTheDocument();
    });

    it("should not show 'Browse catalog' CTA link", () => {
      render(<PlaylistEmptyState gamesLength={3} />);
      expect(screen.queryByRole("link", { name: /browse catalog/i })).not.toBeInTheDocument();
    });
  });
});
