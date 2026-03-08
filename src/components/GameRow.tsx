"use client";

import { useRef, useState } from "react";
import type { Game } from "@/types";
import { TrashIcon, YouTubeLogo, CheckIcon, XIcon } from "@/components/Icons";
import { Toggle } from "@/components/Toggle";

export function formatPlaytime(minutes: number | null): string | null {
  if (minutes == null) return null;
  if (minutes === 0) return "Never played";
  if (minutes < 60) return "< 1 hr";
  return `${Math.round(minutes / 60)} hrs`;
}

function SteamCoverArt({ appid, title }: { appid: number; title: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="w-[46px] h-[22px] rounded bg-zinc-800 shrink-0" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`}
      alt={title}
      width={46}
      height={22}
      className="w-[46px] h-[22px] rounded object-cover shrink-0 bg-zinc-800"
      onError={() => setFailed(true)}
    />
  );
}

function parsePlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const list = url.searchParams.get("list");
    if (list) return list;
  } catch {
    // not a URL — treat as raw ID
  }
  if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
}

export function GameRow({
  game,
  ytPlaylistId,
  onToggle,
  onDelete,
  onPlaylistChange,
}: {
  game: Game;
  ytPlaylistId: string | null;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  onPlaylistChange: (id: string, playlistId: string | null) => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState(false);
  const [playlistInput, setPlaylistInput] = useState("");
  const [playlistError, setPlaylistError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const playtime = formatPlaytime(game.playtime_minutes);

  async function handleToggle(value: boolean) {
    setToggling(true);
    await onToggle(game.id, value);
    setToggling(false);
  }

  function openPlaylistEdit() {
    setPlaylistInput(ytPlaylistId ? `https://www.youtube.com/playlist?list=${ytPlaylistId}` : "");
    setPlaylistError(false);
    setEditingPlaylist(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handlePlaylistSave() {
    if (!playlistInput.trim()) {
      onPlaylistChange(game.id, null);
      setEditingPlaylist(false);
      return;
    }
    const id = parsePlaylistId(playlistInput);
    if (!id) {
      setPlaylistError(true);
      return;
    }
    onPlaylistChange(game.id, id);
    setEditingPlaylist(false);
  }

  function handlePlaylistKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handlePlaylistSave();
    if (e.key === "Escape") setEditingPlaylist(false);
  }

  return (
    <div
      className={`group rounded-xl border px-3.5 pt-2.5 pb-2 transition-colors ${
        game.enabled
          ? "bg-zinc-900/60 border-white/[0.07]"
          : "bg-zinc-950/60 border-white/[0.03] opacity-60"
      }`}
    >
      {/* Main row */}
      <div className="flex items-center gap-3">
        {game.steam_appid ? (
          <SteamCoverArt appid={game.steam_appid} title={game.title} />
        ) : (
          <div className="w-[46px] h-[22px] rounded bg-zinc-800/60 shrink-0 flex items-center justify-center">
            <span className="text-[8px] text-zinc-600 font-bold">BGM</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-100 truncate leading-tight">{game.title}</p>
          {playtime && (
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-none">{playtime}</p>
          )}
        </div>

        <Toggle checked={game.enabled} onChange={handleToggle} disabled={toggling} />

        {confirmDelete ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onDelete(game.id)}
              className="rounded-lg bg-red-600/90 hover:bg-red-500 px-2 py-1 text-xs font-medium text-white cursor-pointer"
            >
              Remove
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-2 py-1 text-xs font-medium text-zinc-400 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            title="Remove game"
            className="shrink-0 rounded-lg p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
          >
            <TrashIcon />
          </button>
        )}
      </div>

      {/* Playlist row */}
      <div className="mt-1 pl-[58px]">
        {editingPlaylist ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={playlistInput}
              onChange={(e) => { setPlaylistInput(e.target.value); setPlaylistError(false); }}
              onKeyDown={handlePlaylistKeyDown}
              placeholder="youtube.com/playlist?list=… or playlist ID"
              className={`flex-1 min-w-0 rounded-md bg-zinc-800/80 border px-2.5 py-1 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500/60 ${
                playlistError ? "border-red-500/60" : "border-white/[0.07]"
              }`}
            />
            <button
              onClick={handlePlaylistSave}
              title="Save"
              className="shrink-0 rounded-md p-1 text-teal-400 hover:bg-teal-500/10 cursor-pointer"
            >
              <CheckIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setEditingPlaylist(false)}
              title="Cancel"
              className="shrink-0 rounded-md p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 cursor-pointer"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : ytPlaylistId ? (
          <div className="flex items-center gap-2">
            <a
              href={`https://www.youtube.com/playlist?list=${ytPlaylistId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-red-400 transition-colors"
            >
              <YouTubeLogo className="w-3 h-3 text-red-500/70" />
              View playlist
            </a>
            <button
              onClick={openPlaylistEdit}
              className="text-[11px] text-zinc-700 hover:text-zinc-400 cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
            >
              · Change
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-700 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-zinc-700 shrink-0 inline-block" />
              Will discover on next run
            </span>
            <button
              onClick={openPlaylistEdit}
              className="text-[11px] text-zinc-600 hover:text-teal-400 cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
            >
              · Set manually
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
