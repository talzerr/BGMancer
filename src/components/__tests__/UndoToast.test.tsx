// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UndoToast } from "../UndoToast";
import { TrackStatus } from "@/types";
import type { PlaylistTrack } from "@/types";
import {
  TEST_PLAYLIST_TRACK_ID,
  TEST_PLAYLIST_ID,
  TEST_GAME_ID,
  TEST_GAME_TITLE,
  TEST_TRACK_NAME,
  TEST_VIDEO_ID,
  TEST_VIDEO_TITLE,
  TEST_CHANNEL_TITLE,
  TEST_THUMBNAIL_URL,
  TEST_DURATION_SECONDS,
} from "@/test/constants";

afterEach(() => {
  cleanup();
});

function makeTrack(overrides: Partial<PlaylistTrack> = {}): PlaylistTrack {
  return {
    id: TEST_PLAYLIST_TRACK_ID,
    playlist_id: TEST_PLAYLIST_ID,
    game_id: TEST_GAME_ID,
    game_title: TEST_GAME_TITLE,
    game_steam_appid: null,
    track_name: TEST_TRACK_NAME,
    video_id: TEST_VIDEO_ID,
    video_title: TEST_VIDEO_TITLE,
    channel_title: TEST_CHANNEL_TITLE,
    thumbnail: TEST_THUMBNAIL_URL,
    search_queries: null,
    duration_seconds: TEST_DURATION_SECONDS,
    position: 0,
    status: TrackStatus.Found,
    error_message: null,
    created_at: "2025-01-01",
    synced_at: null,
    ...overrides,
  };
}

describe("UndoToast", () => {
  it("should display track name followed by 'removed'", () => {
    render(<UndoToast track={makeTrack()} onUndo={vi.fn()} />);
    expect(screen.getByText(TEST_TRACK_NAME)).toBeInTheDocument();
    expect(screen.getByText("removed")).toBeInTheDocument();
  });

  it("should display video_title when track_name is null", () => {
    render(<UndoToast track={makeTrack({ track_name: null })} onUndo={vi.fn()} />);
    expect(screen.getByText(TEST_VIDEO_TITLE)).toBeInTheDocument();
  });

  it("should display 'Track' when both track_name and video_title are null", () => {
    render(
      <UndoToast track={makeTrack({ track_name: null, video_title: null })} onUndo={vi.fn()} />,
    );
    expect(screen.getByText("Track")).toBeInTheDocument();
  });

  describe("when Undo button is clicked", () => {
    it("should call onUndo", async () => {
      const onUndo = vi.fn();
      render(<UndoToast track={makeTrack()} onUndo={onUndo} />);
      await userEvent.click(screen.getByRole("button", { name: /undo/i }));
      expect(onUndo).toHaveBeenCalled();
    });
  });

  it("should render the countdown bar", () => {
    const { container } = render(<UndoToast track={makeTrack()} onUndo={vi.fn()} />);
    const bar = container.querySelector("[style*='animation']");
    expect(bar).toBeInTheDocument();
  });
});
