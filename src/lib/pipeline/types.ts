import type { Game, PlaylistTrack, GameProgressStatus, TaggedTrack } from "@/types";

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
  | { kind: "tagged"; game: Game; tracks: TaggedTrack[] }
  | { kind: "fallback"; game: Game; pendingTracks: PendingTrack[] };
