// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameRow } from "../GameRow";

afterEach(() => {
  cleanup();
});
import { CurationMode } from "@/types";
import type { Game } from "@/types";
import { TEST_GAME_ID, TEST_GAME_TITLE, TEST_STEAM_APPID } from "@/test/constants";

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: TEST_GAME_ID,
    title: TEST_GAME_TITLE,
    curation: CurationMode.Include,
    steam_appid: TEST_STEAM_APPID,
    onboarding_phase: "tagged",
    published: true,
    tracklist_source: null,
    yt_playlist_id: null,
    thumbnail_url: null,
    needs_review: false,
    created_at: "",
    updated_at: "",
    ...overrides,
  } as Game;
}

describe("GameRow", () => {
  describe("when rendered with a game", () => {
    it("should display the game title", () => {
      render(<GameRow game={makeGame()} onCurationChange={vi.fn()} onDelete={vi.fn()} />);
      expect(screen.getByText(TEST_GAME_TITLE)).toBeInTheDocument();
    });

    it("should show all curation mode buttons", () => {
      render(<GameRow game={makeGame()} onCurationChange={vi.fn()} onDelete={vi.fn()} />);
      expect(screen.getByText("Skip")).toBeInTheDocument();
      expect(screen.getByText("Lite")).toBeInTheDocument();
      expect(screen.getByText("Include")).toBeInTheDocument();
      expect(screen.getByText("Focus")).toBeInTheDocument();
    });
  });

  describe("when a curation button is clicked", () => {
    it("should call onCurationChange with the game id and new mode", async () => {
      const onCurationChange = vi.fn();
      render(<GameRow game={makeGame()} onCurationChange={onCurationChange} onDelete={vi.fn()} />);
      await userEvent.click(screen.getByText("Focus"));
      expect(onCurationChange).toHaveBeenCalledWith(TEST_GAME_ID, CurationMode.Focus);
    });

    it("should not call onCurationChange when clicking the already-active mode", async () => {
      const onCurationChange = vi.fn();
      render(
        <GameRow
          game={makeGame({ curation: CurationMode.Include })}
          onCurationChange={onCurationChange}
          onDelete={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByText("Include"));
      expect(onCurationChange).not.toHaveBeenCalled();
    });
  });

  describe("when the delete button is clicked", () => {
    it("should show a confirmation step before deleting", async () => {
      const onDelete = vi.fn();
      render(<GameRow game={makeGame()} onCurationChange={vi.fn()} onDelete={onDelete} />);

      // Click the trash icon
      const deleteBtn = screen.getByTitle("Remove game");
      await userEvent.click(deleteBtn);

      // Should show confirm/cancel, not call onDelete yet
      expect(onDelete).not.toHaveBeenCalled();
      expect(screen.getByText("Remove")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("should call onDelete after confirmation", async () => {
      const onDelete = vi.fn();
      render(<GameRow game={makeGame()} onCurationChange={vi.fn()} onDelete={onDelete} />);

      await userEvent.click(screen.getByTitle("Remove game"));
      await userEvent.click(screen.getByText("Remove"));
      expect(onDelete).toHaveBeenCalledWith(TEST_GAME_ID);
    });

    it("should cancel deletion when Cancel is clicked", async () => {
      const onDelete = vi.fn();
      render(<GameRow game={makeGame()} onCurationChange={vi.fn()} onDelete={onDelete} />);

      await userEvent.click(screen.getByTitle("Remove game"));
      await userEvent.click(screen.getByText("Cancel"));
      expect(onDelete).not.toHaveBeenCalled();
      // Confirm buttons should be gone, trash icon back
      expect(screen.getByTitle("Remove game")).toBeInTheDocument();
    });
  });

  describe("when the game has no steam_appid", () => {
    it("should show a BGM placeholder instead of Steam cover art", () => {
      render(
        <GameRow
          game={makeGame({ steam_appid: null })}
          onCurationChange={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.getByText("BGM")).toBeInTheDocument();
    });
  });
});
