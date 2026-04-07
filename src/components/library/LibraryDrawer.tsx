"use client";

import { CurationMode } from "@/types";
import type { Game } from "@/types";
import { steamHeaderUrl } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/Icons";
import { useState } from "react";

interface LibraryDrawerProps {
  games: Game[];
  targetTrackCount: number;
  generating: boolean;
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onCurationChange: (gameId: string, curation: CurationMode) => void;
  onRemove: (gameId: string) => void;
  onGenerate: () => void;
}

// Order shown inside the row popover.
// `colorClass` reflects the intensity gradient: Focus is loud (amber), Include
// is the default text weight, Lite is muted. Selection is communicated by the
// checkmark, not the color.
const CURATION_OPTIONS: {
  mode: CurationMode;
  label: string;
  subtitle: string;
  colorClass: string;
}[] = [
  {
    mode: CurationMode.Focus,
    label: "Focus",
    subtitle: "Featured in the playlist",
    colorClass: "text-primary",
  },
  {
    mode: CurationMode.Include,
    label: "Include",
    subtitle: "Mixed in naturally (default)",
    colorClass: "text-foreground",
  },
  {
    mode: CurationMode.Lite,
    label: "Lite",
    subtitle: "Light presence",
    colorClass: "text-[var(--text-tertiary)]",
  },
];

function CurationLabel({ curation }: { curation: CurationMode }) {
  if (curation === CurationMode.Focus) {
    return <span className="text-primary shrink-0 text-[11px]">focus</span>;
  }
  if (curation === CurationMode.Lite) {
    return <span className="shrink-0 text-[11px] text-[var(--text-disabled)]">lite</span>;
  }
  return null;
}

function GameRow({
  game,
  onCurationChange,
  onRemove,
}: {
  game: Game;
  onCurationChange: (gameId: string, curation: CurationMode) => void;
  onRemove: (gameId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  function handleSelect(mode: CurationMode) {
    setOpen(false);
    if (mode !== game.curation) onCurationChange(game.id, mode);
  }

  function handleRemove() {
    setOpen(false);
    onRemove(game.id);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="hover:bg-secondary/60 flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors"
        aria-label={`Configure ${game.title}`}
      >
        <GameThumbnail game={game} />
        <span className="text-foreground min-w-0 flex-1 truncate text-[13px]">{game.title}</span>
        <CurationLabel curation={game.curation} />
      </PopoverTrigger>
      <PopoverContent side="left" align="start" sideOffset={8} className="min-w-[220px]">
        {CURATION_OPTIONS.map(({ mode, label, subtitle, colorClass }) => {
          const isCurrent = mode === game.curation;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => handleSelect(mode)}
              className="hover:bg-secondary/60 flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors"
            >
              <span className="mt-[2px] flex h-3 w-3 shrink-0 items-center justify-center">
                {isCurrent ? <CheckIcon className="text-primary h-3 w-3" /> : null}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className={`text-[13px] ${colorClass}`}>{label}</span>
                <span className="text-[11px] text-[var(--text-tertiary)]">{subtitle}</span>
              </span>
            </button>
          );
        })}
        <div className="border-border my-1 border-t" />
        <button
          type="button"
          onClick={handleRemove}
          className="hover:bg-destructive/10 flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-[var(--destructive)] transition-colors"
        >
          <span className="h-3 w-3 shrink-0" />
          Remove
        </button>
      </PopoverContent>
    </Popover>
  );
}

function GameThumbnail({ game }: { game: Game }) {
  const [failed, setFailed] = useState(false);

  if (game.steam_appid && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={steamHeaderUrl(game.steam_appid)}
        alt={game.title}
        width={48}
        height={22}
        loading="lazy"
        className="bg-secondary h-[22px] w-[48px] shrink-0 rounded object-cover"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className="bg-secondary/60 flex h-[22px] w-[48px] shrink-0 items-center justify-center rounded">
      <span className="text-[9px] font-medium text-[var(--text-tertiary)] uppercase">
        {game.title.charAt(0)}
      </span>
    </div>
  );
}

export function LibraryDrawer({
  games,
  targetTrackCount,
  generating,
  isExpanded,
  onExpandedChange,
  onCurationChange,
  onRemove,
  onGenerate,
}: LibraryDrawerProps) {
  const hasActiveGames = games.length > 0;

  return (
    <aside
      className="border-border bg-background/80 sticky top-[57px] hidden max-h-[calc(100vh-57px)] shrink-0 overflow-hidden border-l transition-[width] duration-300 [transition-timing-function:cubic-bezier(0.25,0.1,0.25,1)] lg:block"
      style={{ width: isExpanded ? 300 : 40 }}
    >
      <div className="relative h-[calc(100vh-57px)] w-[300px]">
        {/* Collapsed strip */}
        <button
          type="button"
          onClick={() => onExpandedChange(true)}
          aria-expanded={isExpanded}
          aria-label="Expand library"
          className={`hover:text-foreground absolute inset-y-0 left-0 flex w-10 cursor-pointer flex-col items-center gap-3 py-3 text-[var(--text-tertiary)] transition-opacity duration-300 ${
            isExpanded ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <ChevronLeftIcon />
          <span className="text-foreground rotate-180 text-sm font-medium [writing-mode:vertical-rl]">
            Library
          </span>
          {games.length > 0 && (
            <span className="rotate-180 text-xs text-[var(--text-tertiary)] tabular-nums [writing-mode:vertical-rl]">
              {games.length}
            </span>
          )}
        </button>

        {/* Expanded drawer */}
        <div
          className={`absolute inset-0 flex flex-col transition-opacity duration-300 ${
            isExpanded ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between px-4 py-3 ${games.length > 0 ? "border-border border-b" : ""}`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-foreground text-sm font-medium">Library</span>
              <span className="text-xs text-[var(--text-tertiary)] tabular-nums">
                {games.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onExpandedChange(false)}
              aria-expanded={isExpanded}
              aria-label="Collapse library"
              className="hover:text-foreground shrink-0 cursor-pointer rounded-md p-1 text-[var(--text-tertiary)]"
            >
              <ChevronRightIcon />
            </button>
          </div>

          {/* Content area */}
          {games.length === 0 ? (
            <div className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
              {/* Equalizer icon — 5 bars, paused */}
              <div className="relative mb-5 flex items-end gap-[3px]">
                <div className="bg-primary/20 h-2.5 w-[3px] rounded-full" />
                <div className="bg-primary/25 h-4 w-[3px] rounded-full" />
                <div className="bg-primary/30 h-6 w-[3px] rounded-full" />
                <div className="bg-primary/25 h-3.5 w-[3px] rounded-full" />
                <div className="bg-primary/20 h-2 w-[3px] rounded-full" />
              </div>

              <p className="text-foreground relative text-[15px] font-medium">
                Your library is empty
              </p>
              <p className="relative mt-2 max-w-[200px] text-xs leading-relaxed text-[var(--text-tertiary)]">
                Add a few soundtracks from the catalog to start your first session.
              </p>

              {/* Fade to transparent at bottom */}
              <div className="from-background/80 pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t to-transparent" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col gap-px p-2">
                {games.map((game) => (
                  <GameRow
                    key={game.id}
                    game={game}
                    onCurationChange={onCurationChange}
                    onRemove={onRemove}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          {hasActiveGames && (
            <div className="border-border border-t px-4 py-3">
              <div className="mb-2.5 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                <span className="tabular-nums">
                  {games.length} game{games.length !== 1 ? "s" : ""}
                </span>
                <span className="tabular-nums">{targetTrackCount} tracks</span>
              </div>
              <Button
                onClick={onGenerate}
                disabled={generating}
                className="bg-primary text-primary-foreground w-full cursor-pointer text-sm font-medium hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generating ? "Curating\u2026" : `Curate ${targetTrackCount} Tracks`}
              </Button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
