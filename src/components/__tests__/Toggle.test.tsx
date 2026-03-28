// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toggle } from "../Toggle";

afterEach(() => {
  cleanup();
});

describe("Toggle", () => {
  describe("when checked is true", () => {
    it("should render with aria-checked true", () => {
      render(<Toggle checked={true} onChange={vi.fn()} />);
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    });
  });

  describe("when checked is false", () => {
    it("should render with aria-checked false", () => {
      render(<Toggle checked={false} onChange={vi.fn()} />);
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    });
  });

  describe("when clicked", () => {
    it("should call onChange with the opposite value", async () => {
      const onChange = vi.fn();
      render(<Toggle checked={false} onChange={onChange} />);
      await userEvent.click(screen.getByRole("switch"));
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it("should call onChange with false when currently true", async () => {
      const onChange = vi.fn();
      render(<Toggle checked={true} onChange={onChange} />);
      await userEvent.click(screen.getByRole("switch"));
      expect(onChange).toHaveBeenCalledWith(false);
    });
  });

  describe("when disabled", () => {
    it("should not call onChange when clicked", async () => {
      const onChange = vi.fn();
      render(<Toggle checked={false} onChange={onChange} disabled />);
      await userEvent.click(screen.getByRole("switch"));
      expect(onChange).not.toHaveBeenCalled();
    });

    it("should have disabled attribute", () => {
      render(<Toggle checked={false} onChange={vi.fn()} disabled />);
      expect(screen.getByRole("switch")).toBeDisabled();
    });
  });
});
