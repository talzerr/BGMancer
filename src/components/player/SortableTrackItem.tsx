import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PlaylistTrackCard } from "@/components/player/PlaylistTrackCard";
import type { PlaylistTrack } from "@/types";

interface SortableTrackItemProps {
  track: PlaylistTrack;
  index: number;
  gameThumbnail?: string;
  isPlaying: boolean;
  isActivelyPlaying: boolean;
  spoilerHidden: boolean;
  isRerolling: boolean;
  onPlay: (trackId: string, index: number) => void;
  onRemove: (track: PlaylistTrack) => void;
  onReroll: (trackId: string) => void;
  /** Extra top margin when this track starts a new arc phase */
  phaseGap?: boolean;
  /** Raw RGB triplet for subtle row background tint */
  accentColor?: string;
}

export const SortableTrackItem = memo(function SortableTrackItem({
  track,
  index,
  gameThumbnail,
  isPlaying,
  isActivelyPlaying,
  spoilerHidden,
  isRerolling,
  onPlay,
  onRemove,
  onReroll,
  phaseGap,
  accentColor,
}: SortableTrackItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? "relative" : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={phaseGap ? "mt-[10px]" : undefined}>
      <PlaylistTrackCard
        track={track}
        gameThumbnail={gameThumbnail}
        isPlaying={isPlaying}
        isActivelyPlaying={isActivelyPlaying}
        spoilerHidden={spoilerHidden}
        isRerolling={isRerolling}
        onPlay={() => onPlay(track.id, index)}
        onRemove={() => onRemove(track)}
        onReroll={() => onReroll(track.id)}
        dragHandleProps={{ ...listeners, ...attributes }}
        isDragging={isDragging}
        accentColor={accentColor}
      />
    </div>
  );
});
