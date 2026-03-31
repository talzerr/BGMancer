// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const mockUseSortable = vi.fn(() => ({
  attributes: { role: "button", tabIndex: 0 },
  listeners: {},
  setNodeRef: vi.fn(),
  transform: null,
  transition: undefined,
  isDragging: false,
}));

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: (...args: unknown[]) => mockUseSortable(...args),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => null } },
}));

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

// Lazy import so that mocks are applied before the module loads
async function loadSortableTrackItem() {
  const mod = await import("../SortableTrackItem");
  return mod.SortableTrackItem;
}

describe("SortableTrackItem", () => {
  it("should render the PlaylistTrackCard within a sortable wrapper", async () => {
    const SortableTrackItem = await loadSortableTrackItem();
    const { container } = render(
      <SortableTrackItem
        track={makeTrack()}
        index={0}
        isPlaying={false}
        isActivelyPlaying={false}
        spoilerHidden={false}
        isRerolling={false}
        onRemove={vi.fn()}
        onReroll={vi.fn()}
      />,
    );
    // The outer div is the sortable wrapper
    expect(container.firstChild).toBeInTheDocument();
    // The card content should be inside
    expect(screen.getByText(TEST_TRACK_NAME)).toBeInTheDocument();
  });

  it("should pass track data through to PlaylistTrackCard", async () => {
    const SortableTrackItem = await loadSortableTrackItem();
    render(
      <SortableTrackItem
        track={makeTrack()}
        index={0}
        isPlaying={false}
        isActivelyPlaying={false}
        spoilerHidden={false}
        isRerolling={false}
        onRemove={vi.fn()}
        onReroll={vi.fn()}
      />,
    );
    expect(screen.getByText(TEST_TRACK_NAME)).toBeInTheDocument();
    expect(screen.getByText(TEST_GAME_TITLE)).toBeInTheDocument();
  });

  it("should forward onPlay/onRemove/onReroll to PlaylistTrackCard", async () => {
    const SortableTrackItem = await loadSortableTrackItem();
    const onPlay = vi.fn();
    const onRemove = vi.fn();
    const onReroll = vi.fn();

    render(
      <SortableTrackItem
        track={makeTrack()}
        index={0}
        isPlaying={false}
        isActivelyPlaying={false}
        spoilerHidden={false}
        isRerolling={false}
        onPlay={onPlay}
        onRemove={onRemove}
        onReroll={onReroll}
      />,
    );

    const buttons = screen.getAllByRole("button");
    // buttons[0] is the drag handle (from useSortable attributes), action buttons follow
    // Reroll is second, remove is last
    await userEvent.click(buttons[1]);
    expect(onReroll).toHaveBeenCalled();

    await userEvent.click(buttons[buttons.length - 1]);
    expect(onRemove).toHaveBeenCalled();
  });

  describe("when isDragging is true", () => {
    it("should apply z-index styling", async () => {
      mockUseSortable.mockReturnValueOnce({
        attributes: { role: "button", tabIndex: 0 },
        listeners: {},
        setNodeRef: vi.fn(),
        transform: null,
        transition: undefined,
        isDragging: true,
      });

      const SortableTrackItem = await loadSortableTrackItem();
      const { container } = render(
        <SortableTrackItem
          track={makeTrack()}
          index={0}
          isPlaying={false}
          isActivelyPlaying={false}
          spoilerHidden={false}
          isRerolling={false}
          onRemove={vi.fn()}
          onReroll={vi.fn()}
        />,
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.zIndex).toBe("10");
    });
  });
});
