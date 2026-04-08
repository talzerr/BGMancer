// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogHeaderBar } from "../CatalogHeaderBar";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CatalogHeaderBar", () => {
  describe("search input", () => {
    it("should render with the provided search value", () => {
      render(<CatalogHeaderBar search="hollow" onSearchChange={vi.fn()} />);
      expect(screen.getByPlaceholderText("Filter games...")).toHaveValue("hollow");
    });

    it("should call onSearchChange when the user types", async () => {
      const user = userEvent.setup();
      const onSearchChange = vi.fn();
      render(<CatalogHeaderBar search="" onSearchChange={onSearchChange} />);

      await user.type(screen.getByPlaceholderText("Filter games..."), "cel");

      expect(onSearchChange).toHaveBeenCalledTimes(3);
      expect(onSearchChange).toHaveBeenNthCalledWith(1, "c");
      expect(onSearchChange).toHaveBeenNthCalledWith(2, "e");
      expect(onSearchChange).toHaveBeenNthCalledWith(3, "l");
    });
  });

  describe("children slot", () => {
    it("renders children to the right of the search input", () => {
      render(
        <CatalogHeaderBar search="" onSearchChange={vi.fn()}>
          <button>right-side</button>
        </CatalogHeaderBar>,
      );
      expect(screen.getByRole("button", { name: "right-side" })).toBeInTheDocument();
    });
  });
});
