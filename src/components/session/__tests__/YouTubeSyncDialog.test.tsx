// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { YouTubeSyncDialog } from "../YouTubeSyncDialog";
import type { SyncStatus } from "@/hooks/player/useSync";

afterEach(() => {
  cleanup();
});

function renderDialog(overrides: {
  open?: boolean;
  status?: SyncStatus;
  error?: string | null;
  onConfirm?: () => void | Promise<void>;
  onOpenChange?: (open: boolean) => void;
}) {
  const props = {
    open: overrides.open ?? true,
    onOpenChange: overrides.onOpenChange ?? vi.fn(),
    status: overrides.status ?? ("idle" as SyncStatus),
    error: overrides.error ?? null,
    onConfirm: overrides.onConfirm ?? vi.fn(),
  };
  render(<YouTubeSyncDialog {...props} />);
  return props;
}

describe("YouTubeSyncDialog", () => {
  describe("when open", () => {
    it("renders the title, body copy, and both action buttons", () => {
      renderDialog({});
      // Title and primary button both say "Sync to YouTube" — disambiguate
      // via role.
      expect(screen.getByRole("heading", { name: "Sync to YouTube" })).toBeInTheDocument();
      expect(screen.getByText(/This will create a YouTube playlist/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Sync to YouTube" })).toBeInTheDocument();
    });
  });

  describe("when syncing", () => {
    it("renames the primary button and disables both buttons", () => {
      renderDialog({ status: "syncing" });
      const primary = screen.getByRole("button", { name: "Syncing…" });
      const cancel = screen.getByRole("button", { name: "Cancel" });
      expect(primary).toBeDisabled();
      expect(cancel).toBeDisabled();
    });
  });

  describe("when error is set", () => {
    it("renders the error row below the body", () => {
      renderDialog({ error: "YouTube is rate-limiting us. Try again in a few minutes." });
      expect(
        screen.getByText("YouTube is rate-limiting us. Try again in a few minutes."),
      ).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("calls onOpenChange(false) when Cancel is clicked", async () => {
      const onOpenChange = vi.fn();
      renderDialog({ onOpenChange });
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("calls onConfirm when the primary button is clicked", async () => {
      const onConfirm = vi.fn();
      renderDialog({ onConfirm });
      await userEvent.click(screen.getByRole("button", { name: "Sync to YouTube" }));
      expect(onConfirm).toHaveBeenCalled();
    });

    it("does not call onConfirm while syncing", async () => {
      const onConfirm = vi.fn();
      renderDialog({ status: "syncing", onConfirm });
      await userEvent.click(screen.getByRole("button", { name: "Syncing…" }));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });
});
