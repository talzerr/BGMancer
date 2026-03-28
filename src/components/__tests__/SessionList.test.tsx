// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

afterEach(() => {
  cleanup();
});

import { SessionList } from "../SessionList";
import type { PlaylistSessionWithCount } from "@/types";
import { TEST_PLAYLIST_ID, TEST_SESSION_NAME } from "@/test/constants";

// ─── File-level constants ────────────────────────────────────────────────────

const SESSION_A_ID = TEST_PLAYLIST_ID;
const SESSION_B_ID = "pl2";
const SESSION_A_NAME = TEST_SESSION_NAME;
const SESSION_B_NAME = "Second Session";
const SESSION_A_TRACK_COUNT = 25;
const SESSION_B_TRACK_COUNT = 50;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSession(id: string, name: string, trackCount: number): PlaylistSessionWithCount {
  return {
    id,
    user_id: "u1",
    name,
    description: null,
    is_archived: false,
    track_count: trackCount,
    created_at: new Date().toISOString(),
  };
}

const TWO_SESSIONS = [
  makeSession(SESSION_A_ID, SESSION_A_NAME, SESSION_A_TRACK_COUNT),
  makeSession(SESSION_B_ID, SESSION_B_NAME, SESSION_B_TRACK_COUNT),
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SessionList", () => {
  describe("when sessions list is empty", () => {
    it("should show the empty state message", () => {
      render(<SessionList sessions={[]} selectedId={null} onSelect={vi.fn()} onDelete={vi.fn()} />);
      expect(screen.getByText(/no playlists yet/i)).toBeInTheDocument();
    });

    it("should NOT render any session rows", () => {
      render(<SessionList sessions={[]} selectedId={null} onSelect={vi.fn()} onDelete={vi.fn()} />);
      expect(screen.queryByText(SESSION_A_NAME)).not.toBeInTheDocument();
    });
  });

  describe("when sessions exist", () => {
    it("should render session names", () => {
      render(
        <SessionList
          sessions={TWO_SESSIONS}
          selectedId={null}
          onSelect={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.getByText(SESSION_A_NAME)).toBeInTheDocument();
      expect(screen.getByText(SESSION_B_NAME)).toBeInTheDocument();
    });

    it("should render track counts with labels", () => {
      render(
        <SessionList
          sessions={TWO_SESSIONS}
          selectedId={null}
          onSelect={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.getByText(/25 tracks/)).toBeInTheDocument();
      expect(screen.getByText(/50 tracks/)).toBeInTheDocument();
    });

    it("should show 'Today' for sessions created today", () => {
      render(
        <SessionList
          sessions={TWO_SESSIONS}
          selectedId={null}
          onSelect={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      const todayLabels = screen.getAllByText(/Today/);
      expect(todayLabels.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("when a session is selected", () => {
    it("should show the teal indicator dot on the selected session", () => {
      render(
        <SessionList
          sessions={TWO_SESSIONS}
          selectedId={SESSION_A_ID}
          onSelect={vi.fn()}
          onDelete={vi.fn()}
        />,
      );

      // The selected row's indicator dot has the bg-teal-400 class
      const sessionAName = screen.getByText(SESSION_A_NAME);
      const selectedRow = sessionAName.closest("[class*='bg-zinc-800']");
      expect(selectedRow).toBeInTheDocument();
      const tealDot = selectedRow!.querySelector(".bg-teal-400");
      expect(tealDot).toBeInTheDocument();
    });

    it("should NOT show the teal indicator on unselected sessions", () => {
      render(
        <SessionList
          sessions={TWO_SESSIONS}
          selectedId={SESSION_A_ID}
          onSelect={vi.fn()}
          onDelete={vi.fn()}
        />,
      );

      const sessionBName = screen.getByText(SESSION_B_NAME);
      const unselectedRow = sessionBName.closest("[class*='hover']");
      expect(unselectedRow).toBeInTheDocument();
      const tealDot = unselectedRow!.querySelector(".bg-teal-400");
      expect(tealDot).not.toBeInTheDocument();
    });
  });

  describe("when a session is clicked", () => {
    it("should call onSelect with the session id", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(
        <SessionList
          sessions={TWO_SESSIONS}
          selectedId={null}
          onSelect={onSelect}
          onDelete={vi.fn()}
        />,
      );

      await user.click(screen.getByText(SESSION_B_NAME));
      expect(onSelect).toHaveBeenCalledWith(SESSION_B_ID);
    });

    it("should NOT call onDelete when a session is clicked", async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      render(
        <SessionList
          sessions={TWO_SESSIONS}
          selectedId={null}
          onSelect={vi.fn()}
          onDelete={onDelete}
        />,
      );

      await user.click(screen.getByText(SESSION_A_NAME));
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  describe("when delete button is clicked", () => {
    it("should show Delete and Cancel confirmation buttons", async () => {
      const user = userEvent.setup();
      render(
        <SessionList
          sessions={TWO_SESSIONS}
          selectedId={null}
          onSelect={vi.fn()}
          onDelete={vi.fn()}
        />,
      );

      // The delete button has the title "Delete session"
      const deleteButtons = screen.getAllByTitle("Delete session");
      await user.click(deleteButtons[0]);

      expect(screen.getByText("Delete")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("should NOT call onDelete yet", async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      render(
        <SessionList
          sessions={TWO_SESSIONS}
          selectedId={null}
          onSelect={vi.fn()}
          onDelete={onDelete}
        />,
      );

      const deleteButtons = screen.getAllByTitle("Delete session");
      await user.click(deleteButtons[0]);

      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  describe("when Delete is confirmed", () => {
    it("should call onDelete with the session id", async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      render(
        <SessionList
          sessions={TWO_SESSIONS}
          selectedId={null}
          onSelect={vi.fn()}
          onDelete={onDelete}
        />,
      );

      // Click the X button to trigger confirmation
      const deleteButtons = screen.getAllByTitle("Delete session");
      await user.click(deleteButtons[0]);

      // Click the "Delete" confirmation button
      await user.click(screen.getByText("Delete"));
      expect(onDelete).toHaveBeenCalledWith(SESSION_A_ID);
    });
  });

  describe("when Cancel is clicked after delete", () => {
    it("should NOT call onDelete", async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      render(
        <SessionList
          sessions={TWO_SESSIONS}
          selectedId={null}
          onSelect={vi.fn()}
          onDelete={onDelete}
        />,
      );

      const deleteButtons = screen.getAllByTitle("Delete session");
      await user.click(deleteButtons[0]);
      await user.click(screen.getByText("Cancel"));

      expect(onDelete).not.toHaveBeenCalled();
    });

    it("should hide the confirmation buttons", async () => {
      const user = userEvent.setup();
      render(
        <SessionList
          sessions={TWO_SESSIONS}
          selectedId={null}
          onSelect={vi.fn()}
          onDelete={vi.fn()}
        />,
      );

      const deleteButtons = screen.getAllByTitle("Delete session");
      await user.click(deleteButtons[0]);

      // Confirmation visible
      expect(screen.getByText("Delete")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();

      await user.click(screen.getByText("Cancel"));

      // Confirmation hidden
      expect(screen.queryByText("Delete")).not.toBeInTheDocument();
      expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
    });
  });
});
