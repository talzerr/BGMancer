import { PlaylistMode } from "@/types";
import { PLAYLIST_MODE_LABELS } from "./labels";

export type ShortPlaylistTier = "partial" | "sparse" | "empty";

export interface ShortPlaylistMessage {
  count: number;
  requested: number;
  modeName: string;
  tier: ShortPlaylistTier;
  sessionId: string | null;
}

const SPARSE_THRESHOLD = 0.5;

/** Returns null when no message should show: Journey mode, full match, or
 *  before any generation has run. Energy modes only. */
export function buildShortPlaylistMessage(
  count: number,
  requested: number,
  mode: PlaylistMode,
  sessionId: string | null,
): ShortPlaylistMessage | null {
  if (mode === PlaylistMode.Journey) return null;
  if (count >= requested) return null;

  let tier: ShortPlaylistTier;
  if (count === 0) tier = "empty";
  else if (count / requested < SPARSE_THRESHOLD) tier = "sparse";
  else tier = "partial";

  return {
    count,
    requested,
    modeName: PLAYLIST_MODE_LABELS[mode].name,
    tier,
    sessionId,
  };
}

export function formatShortPlaylistText(msg: ShortPlaylistMessage): string {
  switch (msg.tier) {
    case "partial":
      return `Matched ${msg.count} tracks for ${msg.modeName}`;
    case "sparse":
      return `Only ${msg.count} tracks matched the current library in ${msg.modeName}`;
    case "empty":
      return "No tracks matched the current library in this mode";
  }
}
