// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ModeSelector } from "../ModeSelector";
import { PlaylistMode } from "@/types";

afterEach(() => {
  cleanup();
});

// All four descriptions render in a stacked grid cell so the row height
// stays constant across mode switches; only the active one is visible.
// Tests must check `aria-hidden` rather than DOM presence to verify visibility.
function expectActiveDescription(text: RegExp): void {
  const node = screen.getByText(text);
  expect(node).toHaveAttribute("aria-hidden", "false");
}

function expectHiddenDescription(text: RegExp): void {
  const node = screen.getByText(text);
  expect(node).toHaveAttribute("aria-hidden", "true");
}

describe("ModeSelector", () => {
  describe("when mode is Journey (default)", () => {
    it("shows Journey's description as the visible one", () => {
      render(<ModeSelector mode={PlaylistMode.Journey} onModeChange={vi.fn()} />);
      expect(screen.getByText("Journey")).toBeInTheDocument();
      expectActiveDescription(/full bgmancer experience/i);
    });

    it("hides the other modes' descriptions", () => {
      render(<ModeSelector mode={PlaylistMode.Journey} onModeChange={vi.fn()} />);
      expectHiddenDescription(/background music for work/i);
      expectHiddenDescription(/steady mix for long sessions/i);
      expectHiddenDescription(/high energy for workouts/i);
    });

    it("renders Chill, Mix, Rush as inactive options", () => {
      render(<ModeSelector mode={PlaylistMode.Journey} onModeChange={vi.fn()} />);
      expect(screen.getByRole("button", { name: "Chill" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Mix" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Rush" })).toBeInTheDocument();
    });

    it("does not render Journey as a button", () => {
      render(<ModeSelector mode={PlaylistMode.Journey} onModeChange={vi.fn()} />);
      expect(screen.queryByRole("button", { name: "Journey" })).not.toBeInTheDocument();
    });
  });

  describe("when mode is Chill", () => {
    it("shows Chill's description as the visible one", () => {
      render(<ModeSelector mode={PlaylistMode.Chill} onModeChange={vi.fn()} />);
      expect(screen.getByText("Chill")).toBeInTheDocument();
      expectActiveDescription(/background music for work/i);
    });

    it("hides the other modes' descriptions", () => {
      render(<ModeSelector mode={PlaylistMode.Chill} onModeChange={vi.fn()} />);
      expectHiddenDescription(/full bgmancer experience/i);
      expectHiddenDescription(/steady mix for long sessions/i);
      expectHiddenDescription(/high energy for workouts/i);
    });

    it("renders Journey, Mix, Rush as inactive options", () => {
      render(<ModeSelector mode={PlaylistMode.Chill} onModeChange={vi.fn()} />);
      expect(screen.getByRole("button", { name: "Journey" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Mix" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Rush" })).toBeInTheDocument();
    });
  });

  describe("when an inactive mode is clicked", () => {
    it("calls onModeChange with the clicked mode value", () => {
      const onModeChange = vi.fn();
      render(<ModeSelector mode={PlaylistMode.Journey} onModeChange={onModeChange} />);
      fireEvent.click(screen.getByRole("button", { name: "Rush" }));
      expect(onModeChange).toHaveBeenCalledWith(PlaylistMode.Rush);
    });
  });
});
