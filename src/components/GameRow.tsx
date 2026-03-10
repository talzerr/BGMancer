"use client";

import { useRef, useState } from "react";
import { CurationMode } from "@/types";
import type { Game } from "@/types";
import { TrashIcon, YouTubeLogo, CheckIcon, XIcon } from "@/components/Icons";
import { steamHeaderUrl } from "@/lib/constants";

const CURATION_OPTIONS: {
  mode: CurationMode;
  label: string;
  tooltip: string;
  activeClass: string;
}[] = [
  {
    mode: CurationMode.Skip,
    label: "Skip",
    tooltip: "Excluded from all playlists",
    activeClass: "bg-zinc-700 text-zinc-200",
  },
  {
    mode: CurationMode.Lite,
    label: "Lite",
    tooltip: "Occasional tracks — enters curation with fewer candidates",
    activeClass: "bg-blue-600/30 text-blue-300",
  },
  {
    mode: CurationMode.Include,
    label: "Include",
    tooltip: "Standard inclusion — normal representation in playlists",
    activeClass: "bg-teal-600/30 text-teal-300",
  },
  {
    mode: CurationMode.Focus,
    label: "Focus",
    tooltip: "Guaranteed tracks in every playlist — bypasses AI curation",
    activeClass: "bg-amber-600/30 text-amber-300",
  },
];

export function formatPlaytime(minutes: number | null): string | null {
  if (minutes == null) return null;
  if (minutes === 0) return "Never played";
  if (minutes < 60) return "< 1 hr";
  return `${Math.round(minutes / 60)} hrs`;
}

function SteamCoverArt({ appid, title }: { appid: number; title: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="h-[22px] w-[46px] shrink-0 rounded bg-zinc-800" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={steamHeaderUrl(appid)}
      alt={title}
      width={46}
      height={22}
      className="h-[22px] w-[46px] shrink-0 rounded bg-zinc-800 object-cover"
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
  onCurationChange,
  onDelete,
  onPlaylistChange,
}: {
  game: Game;
  ytPlaylistId: string | null;
  onCurationChange: (id: string, curation: CurationMode) => void;
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

  async function handleCurationChange(mode: CurationMode) {
    if (mode === game.curation) return;
    setToggling(true);
    await onCurationChange(game.id, mode);
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

  const rowClass = {
    skip: "border-white/[0.03] bg-zinc-950/60 opacity-50",
    lite: "border-white/[0.05] bg-zinc-900/40",
    include: "border-white/[0.07] bg-zinc-900/60",
    focus: "border-amber-500/20 bg-amber-950/20",
  }[game.curation];

  return (
    <div className={`group rounded-xl border px-3.5 pt-2.5 pb-2 transition-colors ${rowClass}`}>
      {/* Main row */}
      <div className="flex items-center gap-3">
        {game.steam_appid ? (
          <SteamCoverArt appid={game.steam_appid} title={game.title} />
        ) : (
          <div className="flex h-[22px] w-[46px] shrink-0 items-center justify-center rounded bg-zinc-800/60">
            <span className="text-[8px] font-bold text-zinc-600">BGM</span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-tight font-medium text-zinc-100">{game.title}</p>
          {playtime && <p className="mt-0.5 text-[11px] leading-none text-zinc-500">{playtime}</p>}
        </div>

        <div className="flex shrink-0 overflow-hidden rounded-lg border border-white/[0.07]">
          {CURATION_OPTIONS.map(({ mode, label, tooltip, activeClass }) => (
            <button
              key={mode}
              title={tooltip}
              onClick={() => handleCurationChange(mode)}
              disabled={toggling}
              className={`cursor-pointer px-2 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed ${
                game.curation === mode ? activeClass : "text-zinc-600 hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {confirmDelete ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => onDelete(game.id)}
              className="cursor-pointer rounded-lg bg-red-600/90 px-2 py-1 text-xs font-medium text-white hover:bg-red-500"
            >
              Remove
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="cursor-pointer rounded-lg bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            title="Remove game"
            className="shrink-0 cursor-pointer rounded-lg p-1.5 text-zinc-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
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
              onChange={(e) => {
                setPlaylistInput(e.target.value);
                setPlaylistError(false);
              }}
              onKeyDown={handlePlaylistKeyDown}
              placeholder="youtube.com/playlist?list=… or playlist ID"
              className={`min-w-0 flex-1 rounded-md border bg-zinc-800/80 px-2.5 py-1 text-xs text-white placeholder-zinc-600 focus:ring-1 focus:ring-teal-500/60 focus:outline-none ${
                playlistError ? "border-red-500/60" : "border-white/[0.07]"
              }`}
            />
            <button
              onClick={handlePlaylistSave}
              title="Save"
              className="shrink-0 cursor-pointer rounded-md p-1 text-teal-400 hover:bg-teal-500/10"
            >
              <CheckIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setEditingPlaylist(false)}
              title="Cancel"
              className="shrink-0 cursor-pointer rounded-md p-1 text-zinc-500 hover:bg-zinc-700/50 hover:text-zinc-300"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : ytPlaylistId ? (
          <div className="flex items-center gap-2">
            <a
              href={`https://www.youtube.com/playlist?list=${ytPlaylistId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] text-zinc-500 transition-colors hover:text-red-400"
            >
              <YouTubeLogo className="h-3 w-3 text-red-500/70" />
              View playlist
            </a>
            <button
              onClick={openPlaylistEdit}
              className="cursor-pointer text-[11px] text-zinc-700 opacity-0 transition-all group-hover:opacity-100 hover:text-zinc-400"
            >
              · Change
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] text-zinc-700">
              <span className="inline-block h-1 w-1 shrink-0 rounded-full bg-zinc-700" />
              Will discover on next run
            </span>
            <button
              onClick={openPlaylistEdit}
              className="cursor-pointer text-[11px] text-zinc-600 opacity-0 transition-all group-hover:opacity-100 hover:text-teal-400"
            >
              · Set manually
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
