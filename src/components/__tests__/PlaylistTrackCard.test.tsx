// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaylistTrackCard } from "../PlaylistTrackCard";
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

// Mock next/image as a plain img
vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    return <img {...props} />;
  },
}));

afterEach(() => {
  cleanup();
});

function makeTrack(overrides: Partial<PlaylistTrack> = {}): PlaylistTrack {
  return {
    id: TEST_PLAYLIST_TRACK_ID,
    playlist_id: TEST_PLAYLIST_ID,
    game_id: TEST_GAME_ID,
    game_title: TEST_GAME_TITLE,
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

describe("PlaylistTrackCard", () => {
  describe("when rendered with a found track", () => {
    it("should display the track name", () => {
      render(<PlaylistTrackCard track={makeTrack()} index={0} />);
      // track_name is shown when present (preferred over video_title)
      expect(screen.getByText(TEST_TRACK_NAME)).toBeInTheDocument();
    });

    it("should display the game title", () => {
      render(<PlaylistTrackCard track={makeTrack()} index={0} />);
      expect(screen.getByText(TEST_GAME_TITLE)).toBeInTheDocument();
    });

    it("should display the channel title", () => {
      render(<PlaylistTrackCard track={makeTrack()} index={0} />);
      expect(screen.getByText(TEST_CHANNEL_TITLE)).toBeInTheDocument();
    });

    it("should display the 1-indexed position number", () => {
      render(<PlaylistTrackCard track={makeTrack()} index={2} />);
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  describe.each([
    { status: TrackStatus.Pending, label: "pending" },
    { status: TrackStatus.Searching, label: "searching" },
    { status: TrackStatus.Found, label: "found" },
    { status: TrackStatus.Error, label: "error" },
  ])("when track status is $label", ({ status }) => {
    it("should render without crashing", () => {
      render(<PlaylistTrackCard track={makeTrack({ status })} index={0} />);
      expect(screen.getByText(TEST_GAME_TITLE)).toBeInTheDocument();
    });
  });

  describe("when onRemove is provided", () => {
    it("should call onRemove when the remove button is clicked", async () => {
      const onRemove = vi.fn();
      render(<PlaylistTrackCard track={makeTrack()} index={0} onRemove={onRemove} />);
      const buttons = screen.getAllByRole("button");
      // Remove button is the last button
      await userEvent.click(buttons[buttons.length - 1]);
      expect(onRemove).toHaveBeenCalled();
    });
  });

  describe("when onReroll is provided", () => {
    it("should call onReroll when the reroll button is clicked", async () => {
      const onReroll = vi.fn();
      render(<PlaylistTrackCard track={makeTrack()} index={0} onReroll={onReroll} />);
      const buttons = screen.getAllByRole("button");
      // Reroll is the first (and only) button when no onRemove
      await userEvent.click(buttons[0]);
      expect(onReroll).toHaveBeenCalled();
    });
  });

  describe("when isRerolling is true", () => {
    it("should disable the reroll button", () => {
      render(<PlaylistTrackCard track={makeTrack()} index={0} onReroll={vi.fn()} isRerolling />);
      const buttons = screen.getAllByRole("button");
      const rerollBtn = buttons.find(
        (b) => b.textContent?.includes("Imported") || (b as HTMLButtonElement).disabled,
      );
      expect(rerollBtn).toBeDefined();
      expect(rerollBtn!).toBeDisabled();
    });
  });

  describe("when spoilerHidden is true", () => {
    it("should hide the channel title", () => {
      render(<PlaylistTrackCard track={makeTrack()} index={0} spoilerHidden />);
      expect(screen.queryByText(TEST_CHANNEL_TITLE)).not.toBeInTheDocument();
    });

    it("should apply blur to the game title", () => {
      render(<PlaylistTrackCard track={makeTrack()} index={0} spoilerHidden />);
      const gameTitle = screen.getByText(TEST_GAME_TITLE);
      expect(gameTitle.className).toContain("blur");
    });
  });

  describe("when the track has no video_id (pending)", () => {
    it("should show track_name as the title", () => {
      render(
        <PlaylistTrackCard
          track={makeTrack({ video_id: null, video_title: null, status: TrackStatus.Pending })}
          index={0}
        />,
      );
      expect(screen.getByText(TEST_TRACK_NAME)).toBeInTheDocument();
    });
  });

  describe("when the track has an error status", () => {
    it("should display 'Something went wrong'", () => {
      render(
        <PlaylistTrackCard
          track={makeTrack({ status: TrackStatus.Error, video_id: null, video_title: null })}
          index={0}
        />,
      );
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });

  describe("when no onPlay/onRemove/onReroll handlers are provided", () => {
    it("should not render action buttons", () => {
      render(<PlaylistTrackCard track={makeTrack()} index={0} />);
      const buttons = screen.queryAllByRole("button");
      expect(buttons).toHaveLength(0);
    });
  });
});
