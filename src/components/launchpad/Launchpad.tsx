"use client";

import { useState } from "react";
import Link from "next/link";
import { Headphones } from "lucide-react";
import { usePlayerContext } from "@/context/player-context";
import { useCooldownTimer } from "@/hooks/shared/useCooldownTimer";
import { MAX_TRACK_COUNT } from "@/lib/constants";
import { outlineAmberCtaClass } from "@/components/ui/button";
import { GenerateProgressLine } from "@/components/GenerateProgressLine";
import type { Game } from "@/types";

const PRESETS = [25, 50, 100] as const;
const COVER_ROW_MAX = 6;
const COVER_BOX = "h-[48px] w-[48px] shrink-0 overflow-hidden rounded-[6px]";

interface LaunchpadProps {
  pressedCurate: boolean;
  onCurateClick: () => void;
}

export function Launchpad({ pressedCurate, onCurateClick }: LaunchpadProps) {
  const { gameLibrary, config, playlist } = usePlayerContext();
  const games = gameLibrary.games;
  const { secsLeft } = useCooldownTimer(playlist.cooldownUntil ?? 0);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center pt-16 pb-24">
      {games.length === 0 ? (
        <LaunchpadEmpty />
      ) : (
        <LaunchpadReady
          games={games}
          targetTrackCount={config.targetTrackCount}
          allowLongTracks={config.allowLongTracks}
          allowShortTracks={config.allowShortTracks}
          rawVibes={config.rawVibes}
          onSaveTrackCount={config.saveTrackCount}
          onToggleLongTracks={config.saveAllowLongTracks}
          onToggleShortTracks={config.saveAllowShortTracks}
          onToggleRawVibes={config.saveRawVibes}
          pressedCurate={pressedCurate}
          onCurateClick={onCurateClick}
          secsLeft={secsLeft}
          generating={playlist.generating}
          genError={playlist.genError}
        />
      )}
    </div>
  );
}

function LaunchpadEmpty() {
  return (
    <div className="flex max-w-[400px] flex-col items-center text-center">
      <Headphones strokeWidth={1.5} className="h-7 w-7 text-[var(--text-disabled)]" />
      <p className="mt-5 text-[15px] leading-[1.5] font-normal text-[var(--text-secondary)]">
        Add games from the catalog to build your first playlist
      </p>
      <Link href="/catalog" className={`${outlineAmberCtaClass("md")} mt-6`}>
        Browse catalog →
      </Link>
    </div>
  );
}

interface LaunchpadReadyProps {
  games: Game[];
  targetTrackCount: number;
  allowLongTracks: boolean;
  allowShortTracks: boolean;
  rawVibes: boolean;
  onSaveTrackCount: (n: number) => void;
  onToggleLongTracks: (enabled: boolean) => void;
  onToggleShortTracks: (enabled: boolean) => void;
  onToggleRawVibes: (enabled: boolean) => void;
  pressedCurate: boolean;
  onCurateClick: () => void;
  secsLeft: number;
  generating: boolean;
  genError: string | null;
}

function LaunchpadReady({
  games,
  targetTrackCount,
  allowLongTracks,
  allowShortTracks,
  rawVibes,
  onSaveTrackCount,
  onToggleLongTracks,
  onToggleShortTracks,
  onToggleRawVibes,
  pressedCurate,
  onCurateClick,
  secsLeft,
  generating,
  genError,
}: LaunchpadReadyProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const isCurating = pressedCurate || generating;
  const showCuratingLabel = isCurating;
  const buttonDisabled = isCurating || secsLeft > 0;

  const optionClass = (active: boolean) =>
    `cursor-pointer transition-colors ${
      active
        ? "text-primary font-medium underline decoration-primary/40 underline-offset-4"
        : "text-[var(--text-disabled)] hover:text-[var(--text-tertiary)]"
    }`;

  return (
    <div className="relative flex max-w-[480px] flex-col items-center text-center">
      <CoverRow games={games} />

      <p className="mt-6 text-[13px] text-[var(--text-tertiary)]">
        {games.length} game{games.length !== 1 ? "s" : ""}
      </p>

      <div className="relative mt-1 flex h-[20px] w-full items-center justify-center">
        <Link
          href="/catalog"
          aria-hidden={isCurating}
          tabIndex={isCurating ? -1 : 0}
          className={`absolute text-[12px] text-[var(--text-disabled)] transition-opacity duration-200 hover:text-[var(--text-tertiary)] ${
            isCurating ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          Add games →
        </Link>
        <div
          aria-hidden={!isCurating}
          className={`absolute transition-opacity duration-200 ${
            isCurating ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {isCurating && <GenerateProgressLine games={games} />}
        </div>
      </div>

      <button
        type="button"
        onClick={onCurateClick}
        disabled={buttonDisabled}
        className="bg-primary text-foreground mt-7 cursor-pointer rounded-xl px-10 py-3.5 text-[15px] font-medium transition-all hover:bg-[var(--primary-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {showCuratingLabel ? "Curating…" : `Curate ${targetTrackCount} Tracks`}
      </button>

      <div
        aria-hidden={isCurating}
        className={`mt-5 flex items-center gap-4 text-[12px] transition-opacity duration-200 ${
          isCurating ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <div className="flex items-center gap-3">
          {PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onSaveTrackCount(n)}
              className={`tabular-nums ${optionClass(targetTrackCount === n)}`}
            >
              {n}
            </button>
          ))}
        </div>

        <span className="text-[var(--text-disabled)]">|</span>

        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          className={optionClass(advancedOpen)}
        >
          Advanced
        </button>
      </div>

      {/* Absolute so opening Advanced does not reflow the centered cluster. */}
      <div
        aria-hidden={!advancedOpen || isCurating}
        className={`absolute top-full left-1/2 mt-5 w-[300px] -translate-x-1/2 transition-opacity duration-[180ms] ease-out ${
          advancedOpen && !isCurating ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex flex-col gap-3 border-t border-[var(--border-default)] pt-4">
          <CustomSizeRow
            value={targetTrackCount}
            onChange={onSaveTrackCount}
            isCustom={!(PRESETS as readonly number[]).includes(targetTrackCount)}
          />
          <ToggleRow
            label="Long tracks"
            description="Allow tracks over 9 min"
            on={allowLongTracks}
            onToggle={() => onToggleLongTracks(!allowLongTracks)}
          />
          <ToggleRow
            label="Short tracks"
            description="Allow tracks under 90s"
            on={allowShortTracks}
            onToggle={() => onToggleShortTracks(!allowShortTracks)}
          />
          <ToggleRow
            label="Raw vibes"
            description="Ignore popularity, score on tags only"
            on={rawVibes}
            onToggle={() => onToggleRawVibes(!rawVibes)}
          />
        </div>
      </div>

      {genError && secsLeft === 0 && (
        <p className="text-destructive mt-3 text-[12px]">{genError}</p>
      )}
    </div>
  );
}

function CustomSizeRow({
  value,
  isCustom,
  onChange,
}: {
  value: number;
  isCustom: boolean;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    setDraft(String(value));
  }

  function commit() {
    const v = parseInt(draft, 10);
    if (!isNaN(v) && v >= 1 && v <= MAX_TRACK_COUNT && v !== value) {
      onChange(v);
    } else {
      setDraft(String(value));
    }
  }

  return (
    <div className="flex items-center justify-between">
      <span
        className={`text-[12px] transition-colors ${
          isCustom ? "text-[var(--text-secondary)]" : "text-[var(--text-disabled)]"
        }`}
      >
        Custom size
      </span>
      <input
        type="number"
        min={1}
        max={MAX_TRACK_COUNT}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(String(value));
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label="Custom playlist size"
        className="focus:border-primary/60 w-14 [appearance:textfield] rounded-md border border-[var(--border-default)] bg-transparent px-2 py-1 text-center text-[11px] text-[var(--text-secondary)] tabular-nums focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
  );
}

function ToggleRow({
  label,
  description,
  on,
  onToggle,
}: {
  label: string;
  description: string;
  on: boolean;
  onToggle: () => void;
}) {
  const stateClass = on ? "text-[var(--text-secondary)]" : "text-[var(--text-disabled)]";
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex cursor-pointer items-center justify-between text-left"
    >
      <div className="flex flex-col">
        <span className={`text-[12px] transition-colors ${stateClass}`}>{label}</span>
        <span className="text-[11px] text-[var(--text-quaternary)]">{description}</span>
      </div>
      <span className={`text-[11px] transition-colors ${stateClass}`}>{on ? "on" : "off"}</span>
    </button>
  );
}

function CoverRow({ games }: { games: Game[] }) {
  const visible = games.slice(0, COVER_ROW_MAX);
  const overflow = games.length - COVER_ROW_MAX;

  return (
    <div className="flex items-center gap-2">
      {visible.map((game) => (
        <div key={game.id} className={`bg-secondary ${COVER_BOX}`}>
          {game.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={game.thumbnail_url}
              alt={game.title}
              width={48}
              height={48}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[var(--surface-hover)]">
              <span className="text-muted-foreground text-xs font-medium uppercase">
                {game.title.charAt(0)}
              </span>
            </div>
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div className={`bg-secondary flex items-center justify-center ${COVER_BOX}`}>
          <span className="text-[12px] font-medium text-[var(--text-tertiary)] tabular-nums">
            +{overflow}
          </span>
        </div>
      )}
    </div>
  );
}
