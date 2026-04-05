// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogHeaderBar } from "../CatalogHeaderBar";

// ─── Helpers ───────────────────────────────────────────────────────────────

function renderHeaderBar(overrides: Partial<Parameters<typeof CatalogHeaderBar>[0]> = {}) {
  const props = {
    search: "",
    onSearchChange: vi.fn(),
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
