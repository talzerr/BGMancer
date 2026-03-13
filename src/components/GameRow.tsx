"use client";

import { useState } from "react";
import { CurationMode, TaggingStatus } from "@/types";
import type { Game } from "@/types";
import { TrashIcon, InfoIcon, ErrorCircle } from "@/components/Icons";
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

export function CurationLegend() {
  return (
    <div className="group/info relative">
      <InfoIcon className="h-3 w-3 cursor-default text-zinc-600 transition-colors group-hover/info:text-zinc-400" />
      <div className="pointer-events-none absolute top-full right-0 z-20 mt-2 w-64 rounded-xl border border-white/[0.08] bg-zinc-900 p-3 opacity-0 shadow-xl shadow-black/50 transition-opacity group-hover/info:opacity-100">
        <p className="mb-2 text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
          Curation Modes
        </p>
        <div className="flex flex-col gap-1.5">
          {CURATION_OPTIONS.map(({ mode, label, tooltip, activeClass }) => (
            <div key={mode} className="flex items-start gap-2">
              <span
                className={`w-12 shrink-0 text-[11px] font-semibold ${activeClass.split(" ").find((c) => c.startsWith("text-")) ?? "text-zinc-400"}`}
              >
                {label}
              </span>
              <span className="text-[11px] leading-snug text-zinc-400">{tooltip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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

export function GameRow({
  game,
  onCurationChange,
  onDelete,
}: {
  game: Game;
  onCurationChange: (id: string, curation: CurationMode) => void;
  onDelete: (id: string) => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const playtime = formatPlaytime(game.playtime_minutes);

  async function handleCurationChange(mode: CurationMode) {
    if (mode === game.curation) return;
    setToggling(true);
    await onCurationChange(game.id, mode);
    setToggling(false);
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
          {game.tagging_status === TaggingStatus.Failed && (
            <span className="mt-0.5 inline-block text-yellow-500" title="Limited soundtrack data">
              <ErrorCircle className="h-2.5 w-2.5" />
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex overflow-hidden rounded-lg border border-white/[0.07]">
            {CURATION_OPTIONS.map(({ mode, label, activeClass }) => (
              <button
                key={mode}
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
    </div>
  );
}
