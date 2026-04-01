import type { PlaylistTrack, GameProgressStatus } from "@/types";

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
      sessionId?: string;
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
