// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SyncButton } from "../SyncButton";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderSyncButton(
  overrides: Partial<{
    isSignedIn: boolean;
    isDev: boolean;
    hasFoundTracks: boolean;
    onSyncComplete: () => void;
  }> = {},
) {
  const props = {
    isSignedIn: true,
    isDev: false,
    hasFoundTracks: true,
    onSyncComplete: vi.fn(),
    ...overrides,
  };
  return { ...render(<SyncButton {...props} />), props };
}

describe("SyncButton", () => {
  describe("when isDev is true", () => {
    it("should render nothing", () => {
      const { container } = renderSyncButton({ isDev: true });
      expect(container.innerHTML).toBe("");
    });
  });

  describe("when signed in with found tracks", () => {
    it("should show an enabled button", () => {
      renderSyncButton();
      const button = screen.getByRole("button", { name: /sync to youtube/i });
      expect(button).toBeEnabled();
    });
  });

  describe("when not signed in", () => {
    it("should disable the button", () => {
      renderSyncButton({ isSignedIn: false });
      const button = screen.getByRole("button", { name: /sync to youtube/i });
      expect(button).toBeDisabled();
    });

    it("should have a title mentioning sign in", () => {
      renderSyncButton({ isSignedIn: false });
      const button = screen.getByRole("button", { name: /sync to youtube/i });
      expect(button).toHaveAttribute("title", expect.stringContaining("Sign in"));
    });
  });

  describe("when no found tracks", () => {
    it("should disable the button", () => {
      renderSyncButton({ hasFoundTracks: false });
      const button = screen.getByRole("button", { name: /sync to youtube/i });
      expect(button).toBeDisabled();
    });
  });

  describe("when sync succeeds", () => {
    it("should show success message, call onSyncComplete, and show playlist URL link", async () => {
      const onSyncComplete = vi.fn();
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "Synced 5 tracks",
            synced: 5,
            playlist_url: "https://youtube.com/playlist?list=PLabc",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      renderSyncButton({ onSyncComplete });
      await userEvent.click(screen.getByRole("button", { name: /sync to youtube/i }));

      expect(await screen.findByText("Synced 5 tracks")).toBeInTheDocument();
      expect(onSyncComplete).toHaveBeenCalled();

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "https://youtube.com/playlist?list=PLabc");
    });
  });

  describe("when sync succeeds with errors", () => {
    it("should show partial failure warning", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "Synced 3 tracks",
            synced: 3,
            errors: [
              { game_id: "g1", error: "Not found" },
              { game_id: "g2", error: "Timeout" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      renderSyncButton();
      await userEvent.click(screen.getByRole("button", { name: /sync to youtube/i }));

      expect(await screen.findByText(/2 item\(s\) failed to add/)).toBeInTheDocument();
    });
  });

  describe("when sync fails", () => {
    it("should show error message", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Token expired" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );

      renderSyncButton();
      await userEvent.click(screen.getByRole("button", { name: /sync to youtube/i }));

      expect(await screen.findByText("Token expired")).toBeInTheDocument();
    });

    it("should NOT call onSyncComplete", async () => {
      const onSyncComplete = vi.fn();
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Token expired" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );

      renderSyncButton({ onSyncComplete });
      await userEvent.click(screen.getByRole("button", { name: /sync to youtube/i }));

      await screen.findByText("Token expired");
      expect(onSyncComplete).not.toHaveBeenCalled();
    });
  });

  describe("while syncing", () => {
    it("should show 'Syncing\u2026' text", async () => {
      let resolveRequest!: (value: Response) => void;
      vi.spyOn(global, "fetch").mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
      );

      renderSyncButton();
      await userEvent.click(screen.getByRole("button", { name: /sync to youtube/i }));

      expect(screen.getByText("Syncing\u2026")).toBeInTheDocument();

      // Resolve to avoid hanging promise
      resolveRequest(
        new Response(JSON.stringify({ message: "ok", synced: 0 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    it("should disable the button", async () => {
      let resolveRequest!: (value: Response) => void;
      vi.spyOn(global, "fetch").mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
      );

      renderSyncButton();
      await userEvent.click(screen.getByRole("button", { name: /sync to youtube/i }));

      expect(screen.getByRole("button")).toBeDisabled();

      resolveRequest(
        new Response(JSON.stringify({ message: "ok", synced: 0 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
  });
});
