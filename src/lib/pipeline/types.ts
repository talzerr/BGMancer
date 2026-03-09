import type { Game, PlaylistTrack } from "@/types";
import type { OSTTrack } from "@/lib/services/youtube";

export type GenerateEvent =
  | {
      type: "progress";
      gameId?: string;
      title?: string;
      status?: "active" | "done" | "error";
      message: string;
    }
  | { type: "done"; tracks: PlaylistTrack[]; count: number; found: number; pending: number }
  | { type: "error"; message: string; detail?: string };

export type PendingTrack = Omit<PlaylistTrack, "position" | "created_at" | "synced_at">;

export type GameTracks = { game: Game; tracks: PendingTrack[] };

export type CandidateResult =
  | { kind: "tracks"; game: Game; tracks: OSTTrack[] }
  | { kind: "fallback"; game: Game; pendingTracks: PendingTrack[] };
