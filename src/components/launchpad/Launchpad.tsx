"use client";

import { usePlayerContext } from "@/context/player-context";
import { useCooldownTimer } from "@/hooks/shared/useCooldownTimer";
import { LaunchpadEmpty } from "./LaunchpadEmpty";
import { LaunchpadReady } from "./LaunchpadReady";

interface LaunchpadProps {
  pressedCurate: boolean;
  onCurateClick: () => void;
  previewCovers: string[];
  /** Destructive message for an energy-mode generation that returned zero tracks. */
  emptyModeMessage: string | null;
}

export function Launchpad({
  pressedCurate,
  onCurateClick,
  previewCovers,
  emptyModeMessage,
}: LaunchpadProps) {
  const { gameLibrary, config, playlist } = usePlayerContext();
  const games = gameLibrary.games;
  const { secsLeft } = useCooldownTimer(playlist.cooldownUntil ?? 0);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center pt-16 pb-24">
      {games.length === 0 ? (
        <LaunchpadEmpty previewCovers={previewCovers} />
      ) : (
        <LaunchpadReady
          games={games}
          targetTrackCount={config.targetTrackCount}
          allowLongTracks={config.allowLongTracks}
          allowShortTracks={config.allowShortTracks}
          playlistMode={config.playlistMode}
          onSaveTrackCount={config.saveTrackCount}
          onToggleLongTracks={config.saveAllowLongTracks}
          onToggleShortTracks={config.saveAllowShortTracks}
          onPlaylistModeChange={config.savePlaylistMode}
          pressedCurate={pressedCurate}
          onCurateClick={onCurateClick}
          secsLeft={secsLeft}
          generating={playlist.generating}
          genError={playlist.genError}
          emptyModeMessage={emptyModeMessage}
        />
      )}
    </div>
  );
}
