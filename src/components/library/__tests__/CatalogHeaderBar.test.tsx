// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogHeaderBar, FilterMode } from "../CatalogHeaderBar";

// ─── Helpers ───────────────────────────────────────────────────────────────

function renderHeaderBar(overrides: Partial<Parameters<typeof CatalogHeaderBar>[0]> = {}) {
  const props = {
    search: "",
    onSearchChange: vi.fn(),
    favoriteCount: 0,
    filterMode: FilterMode.All,
    onFilterChange: vi.fn(),
    ...overrides,
  };
  render(<CatalogHeaderBar {...props} />);
  return props;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("CatalogHeaderBar", () => {
  describe("All button", () => {
    it("should always render the All button", () => {
      renderHeaderBar();
      expect(screen.getByText("All")).toBeInTheDocument();
    });

    it("should call onFilterChange with FilterMode.All when clicked", async () => {
      const user = userEvent.setup();
      const props = renderHeaderBar({ filterMode: FilterMode.Favorites, favoriteCount: 3 });

      await user.click(screen.getByText("All"));

      expect(props.onFilterChange).toHaveBeenCalledWith(FilterMode.All);
    });
  });

  describe("Favorites button", () => {
    it("should be visible when favoriteCount > 0", () => {
      renderHeaderBar({ favoriteCount: 5 });
      expect(screen.getByText("★ 5")).toBeInTheDocument();
    });

    it("should be hidden when favoriteCount is 0", () => {
      renderHeaderBar({ favoriteCount: 0 });
      expect(screen.queryByText(/★/)).not.toBeInTheDocument();
    });

    it("should call onFilterChange with FilterMode.Favorites when clicked", async () => {
      const user = userEvent.setup();
      const props = renderHeaderBar({ favoriteCount: 3 });

      await user.click(screen.getByText("★ 3"));

      expect(props.onFilterChange).toHaveBeenCalledWith(FilterMode.Favorites);
    });
  });

  describe("search input", () => {
    it("should render with the provided search value", () => {
      renderHeaderBar({ search: "hollow" });
      expect(screen.getByPlaceholderText("Filter games...")).toHaveValue("hollow");
    });

    it("should call onSearchChange when the user types", async () => {
      const user = userEvent.setup();
      const props = renderHeaderBar();

      await user.type(screen.getByPlaceholderText("Filter games..."), "cel");

      expect(props.onSearchChange).toHaveBeenCalledTimes(3);
      expect(props.onSearchChange).toHaveBeenNthCalledWith(1, "c");
      expect(props.onSearchChange).toHaveBeenNthCalledWith(2, "e");
      expect(props.onSearchChange).toHaveBeenNthCalledWith(3, "l");
    });
  });
});
