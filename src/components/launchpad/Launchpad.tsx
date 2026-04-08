"use client";

import Link from "next/link";
import { Headphones } from "lucide-react";
import { usePlayerContext } from "@/context/player-context";
import { useCooldownTimer } from "@/hooks/shared/useCooldownTimer";
import { steamHeaderUrl } from "@/lib/constants";
import { outlineAmberCtaClass } from "@/components/ui/button";
import type { Game } from "@/types";

interface LaunchpadProps {
  pressedCurate: boolean;
  onCurateClick: () => void;
}

export function Launchpad({ pressedCurate, onCurateClick }: LaunchpadProps) {
  const { gameLibrary, config, playlist } = usePlayerContext();
  const games = gameLibrary.games;
  const { secsLeft, quip } = useCooldownTimer(playlist.cooldownUntil ?? 0);

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
          onSaveTrackCount={config.saveTrackCount}
          onToggleLongTracks={config.saveAllowLongTracks}
          onToggleShortTracks={config.saveAllowShortTracks}
          pressedCurate={pressedCurate}
          onCurateClick={onCurateClick}
          secsLeft={secsLeft}
          quip={quip}
          generating={playlist.generating}
          genError={playlist.genError}
        />
      )}
    </div>
  );
}

// ─── State 1 — empty library ──────────────────────────────────────────────

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

// ─── State 2 — has library, ready to curate ───────────────────────────────

interface LaunchpadReadyProps {
  games: Game[];
  targetTrackCount: number;
  allowLongTracks: boolean;
  allowShortTracks: boolean;
  onSaveTrackCount: (n: number) => void;
  onToggleLongTracks: (enabled: boolean) => void;
  onToggleShortTracks: (enabled: boolean) => void;
  pressedCurate: boolean;
  onCurateClick: () => void;
  secsLeft: number;
  quip: string;
  generating: boolean;
  genError: string | null;
}

const PRESETS = [25, 50, 100] as const;

function LaunchpadReady({
  games,
  targetTrackCount,
  allowLongTracks,
  allowShortTracks,
  onSaveTrackCount,
  onToggleLongTracks,
  onToggleShortTracks,
  pressedCurate,
  onCurateClick,
  secsLeft,
  quip,
  generating,
  genError,
}: LaunchpadReadyProps) {
  const showCuratingLabel = pressedCurate || generating;
  const buttonDisabled = pressedCurate || generating || secsLeft > 0;

  // Single visual language for the entire settings row: off = text-disabled,
  // on = text-secondary with subtle underline matching the size selector.
  const optionClass = (active: boolean) =>
    `cursor-pointer transition-colors ${
      active
        ? "text-[var(--text-secondary)] underline decoration-[var(--text-disabled)] underline-offset-4"
        : "text-[var(--text-disabled)] hover:text-[var(--text-tertiary)]"
    }`;

  return (
    <div className="flex max-w-[480px] flex-col items-center text-center">
      <CoverRow games={games} />

      <p className="mt-6 text-[13px] text-[var(--text-tertiary)]">
        {games.length} game{games.length !== 1 ? "s" : ""}
      </p>

      <Link
        href="/catalog"
        className="mt-1 text-[12px] text-[var(--text-disabled)] transition-colors hover:text-[var(--text-tertiary)]"
      >
        Add games →
      </Link>

      <button
        type="button"
        onClick={onCurateClick}
        disabled={buttonDisabled}
        className="bg-primary text-foreground mt-7 w-fit cursor-pointer rounded-xl px-10 py-3.5 text-[15px] font-medium transition-all hover:bg-[var(--primary-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80"
      >
        {showCuratingLabel
          ? "Curating…"
          : secsLeft > 0
            ? quip
            : `Curate ${targetTrackCount} Tracks`}
      </button>

      <div
        className={`mt-5 flex items-center gap-4 text-[12px] transition-opacity duration-200 ${
          pressedCurate ? "pointer-events-none opacity-30" : "opacity-100"
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
          onClick={() => onToggleLongTracks(!allowLongTracks)}
          className={optionClass(allowLongTracks)}
        >
          Long tracks
        </button>
        <button
          type="button"
          onClick={() => onToggleShortTracks(!allowShortTracks)}
          className={optionClass(allowShortTracks)}
        >
          Short tracks
        </button>
      </div>

      {genError && secsLeft === 0 && (
        <p className="text-destructive mt-3 text-[12px]">{genError}</p>
      )}
    </div>
  );
}

// ─── Cover row ────────────────────────────────────────────────────────────

const COVER_ROW_MAX = 6;
const COVER_BOX = "h-[48px] w-[48px] shrink-0 overflow-hidden rounded-[6px]";

function CoverRow({ games }: { games: Game[] }) {
  const visible = games.slice(0, COVER_ROW_MAX);
  const overflow = games.length - COVER_ROW_MAX;

  return (
    <div className="flex items-center gap-2">
      {visible.map((game) => (
        <div key={game.id} className={`bg-secondary ${COVER_BOX}`}>
          {game.steam_appid ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={steamHeaderUrl(game.steam_appid)}
              alt={game.title}
              width={48}
              height={48}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : game.thumbnail_url ? (
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
