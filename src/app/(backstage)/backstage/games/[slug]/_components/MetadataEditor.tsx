"use client";

import { TracklistSourceField } from "@/components/backstage/TracklistSourceField";
import { MetadataField } from "@/components/backstage/MetadataField";
import type { Game } from "@/types";

export function MetadataEditor({
  game,
  onSaveField,
}: {
  game: Game;
  onSaveField: (field: string, value: string | null) => void;
}) {
  return (
    <div className="border-border bg-secondary/60 rounded-lg border px-4 py-3">
      <div className="mb-3 flex items-center gap-2">
        <p className="text-[11px] font-medium tracking-wider text-[var(--text-tertiary)] uppercase">
          Metadata
        </p>
        {game.published && (
          <span className="text-[10px] text-[var(--text-disabled)]">Unpublish to edit</span>
        )}
      </div>
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
        <TracklistSourceField
          value={game.tracklist_source}
          disabled={game.published}
          onSave={(v) => onSaveField("tracklist_source", v)}
        />
        <MetadataField
          label="YouTube Playlist"
          value={game.yt_playlist_id ?? ""}
          placeholder="e.g. PLxxxxxx"
          disabled={game.published}
          href={
            game.yt_playlist_id
              ? `https://www.youtube.com/playlist?list=${game.yt_playlist_id}`
              : undefined
          }
          onSave={(v) => onSaveField("yt_playlist_id", v)}
        />
        <MetadataField
          label="Thumbnail URL"
          value={game.thumbnail_url ?? ""}
          placeholder="https://..."
          disabled={game.published}
          href={game.thumbnail_url ?? undefined}
          onSave={(v) => onSaveField("thumbnail_url", v)}
        />
        <MetadataField
          label="Steam App ID"
          value={game.steam_appid?.toString() ?? ""}
          placeholder="e.g. 292030"
          disabled={game.published}
          href={
            game.steam_appid ? `https://store.steampowered.com/app/${game.steam_appid}` : undefined
          }
          onSave={(v) => onSaveField("steam_appid", v)}
        />
      </div>
    </div>
  );
}
