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
  onPlay?: () => void;
  onRemove: () => void;
  onReroll: () => void;
}

export function SortableTrackItem({
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
    <div ref={setNodeRef} style={style}>
      <PlaylistTrackCard
        track={track}
        index={index}
        gameThumbnail={gameThumbnail}
        isPlaying={isPlaying}
        isActivelyPlaying={isActivelyPlaying}
        spoilerHidden={spoilerHidden}
        isRerolling={isRerolling}
        onPlay={onPlay}
        onRemove={onRemove}
        onReroll={onReroll}
        dragHandleProps={{ ...listeners, ...attributes }}
        isDragging={isDragging}
      />
    </div>
  );
}
