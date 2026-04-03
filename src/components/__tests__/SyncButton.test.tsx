// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SyncButton } from "../SyncButton";

const mockSignIn = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

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
      const button = screen.getByRole("button", { name: /sync/i });
      expect(button).toBeEnabled();
    });
  });

  describe("when not signed in", () => {
    it("should disable the button", () => {
      renderSyncButton({ isSignedIn: false });
      const button = screen.getByRole("button", { name: /sync/i });
      expect(button).toBeDisabled();
    });
  });

  describe("when no found tracks", () => {
    it("should disable the button", () => {
      renderSyncButton({ hasFoundTracks: false });
      const button = screen.getByRole("button", { name: /sync/i });
      expect(button).toBeDisabled();
    });
  });

  describe("when sync succeeds", () => {
    it("should call onSyncComplete and open playlist URL", async () => {
      const onSyncComplete = vi.fn();
      const mockOpen = vi.spyOn(window, "open").mockImplementation(() => null);
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
      await userEvent.click(screen.getByRole("button", { name: /sync/i }));

      await waitFor(() => expect(onSyncComplete).toHaveBeenCalled());
      expect(mockOpen).toHaveBeenCalledWith(
        "https://youtube.com/playlist?list=PLabc",
        "_blank",
        "noopener,noreferrer",
      );
    });

    it("should show a success status dot", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Synced 5 tracks", synced: 5 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      renderSyncButton();
      await userEvent.click(screen.getByRole("button", { name: /sync/i }));

      await waitFor(() => {
        const button = screen.getByRole("button");
        const dot = button.querySelector(".bg-emerald-500");
        expect(dot).toBeInTheDocument();
      });
    });
  });

  describe("when API returns 401 (no YouTube scope)", () => {
    it("should trigger incremental Google OAuth", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "You must be signed in with Google" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );

      renderSyncButton();
      await userEvent.click(screen.getByRole("button", { name: /sync/i }));

      expect(mockSignIn).toHaveBeenCalledWith(
        "google",
        expect.objectContaining({ callbackUrl: expect.any(String) }),
        expect.objectContaining({ scope: expect.stringContaining("youtube") }),
      );
    });

    it("should NOT call onSyncComplete", async () => {
      const onSyncComplete = vi.fn();
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );

      renderSyncButton({ onSyncComplete });
      await userEvent.click(screen.getByRole("button", { name: /sync/i }));

      await vi.waitFor(() => expect(mockSignIn).toHaveBeenCalled());
      expect(onSyncComplete).not.toHaveBeenCalled();
    });
  });

  describe("when sync fails (non-401)", () => {
    it("should show an error status dot", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Server error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      );

      renderSyncButton();
      await userEvent.click(screen.getByRole("button", { name: /sync/i }));

      await waitFor(() => {
        const button = screen.getByRole("button");
        const dot = button.querySelector(".bg-red-500");
        expect(dot).toBeInTheDocument();
      });
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
      await userEvent.click(screen.getByRole("button", { name: /sync/i }));

      expect(screen.getByText("Syncing\u2026")).toBeInTheDocument();

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
      await userEvent.click(screen.getByRole("button", { name: /sync/i }));

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
