// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ModeSelector } from "../ModeSelector";
import { PlaylistMode } from "@/types";

afterEach(() => {
  cleanup();
});

describe("ModeSelector", () => {
  describe("when mode is Journey (default)", () => {
    it("shows Journey as the active mode with its description", () => {
      render(<ModeSelector mode={PlaylistMode.Journey} onModeChange={vi.fn()} />);
      expect(screen.getByText("Journey")).toBeInTheDocument();
      expect(screen.getByText(/full bgmancer experience/i)).toBeInTheDocument();
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
    it("shows Chill as the active mode with its description", () => {
      render(<ModeSelector mode={PlaylistMode.Chill} onModeChange={vi.fn()} />);
      expect(screen.getByText("Chill")).toBeInTheDocument();
      expect(screen.getByText(/background music for work/i)).toBeInTheDocument();
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
