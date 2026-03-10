import type { Game, PlaylistTrack, GameProgressStatus } from "@/types";
import type { OSTTrack } from "@/lib/services/youtube";

export type GenerateEvent =
  | {
      type: "progress";
      gameId?: string;
      title?: string;
      status?: GameProgressStatus;
      message: string;
    }
  | {
      type: "done";
      sessionId: string;
      tracks: PlaylistTrack[];
      count: number;
      found: number;
      pending: number;
    }
  | { type: "error"; message: string; detail?: string };

export type PendingTrack = Omit<
  PlaylistTrack,
  "playlist_id" | "position" | "created_at" | "synced_at"
>;

export type GameTracks = { game: Game; tracks: PendingTrack[] };

export type CandidateResult =
  | { kind: "tracks"; game: Game; tracks: OSTTrack[] }
  | { kind: "fallback"; game: Game; pendingTracks: PendingTrack[] };
