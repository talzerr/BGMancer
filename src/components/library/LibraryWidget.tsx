import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import { usePlayerContext } from "@/context/player-context";

// Outer box is 40px (h-10/w-10) so the 2px background border can flank a
// visible 36px cover image — 36px is the readability floor.
const COVER_BOX =
  "h-10 w-10 min-h-10 min-w-10 shrink-0 overflow-hidden rounded-[6px] border-2 border-background";
const COVER_PX = 40;
const OVERLAP_PX = 10; // matches -ml-[10px] below
const COMPACT_GAP_PX = 6;

export function LibraryWidget() {
  const { gameLibrary, player, playlist } = usePlayerContext();
  const { games, isLoading } = gameLibrary;

  const playingGameTitle =
    playlist.tracks.find((t) => t.id === player.playingTrackId)?.game_title ?? null;

  // Measure the cover row to figure out how many tiles fit. Recomputes on
  // resize so the stack adapts to the controls column width.
  const coverRowRef = useRef<HTMLDivElement | null>(null);
  const [maxTiles, setMaxTiles] = useState<number>(games.length);
  useLayoutEffect(() => {
    const el = coverRowRef.current;
    if (!el) return;
    let rafId = 0;
    const recompute = () => {
      const width = el.clientWidth;
      if (width <= 0) return;
      const step = COVER_PX - OVERLAP_PX;
      const fit = Math.max(1, Math.floor((width - COVER_PX) / step) + 1);
      setMaxTiles(fit);
    };
    recompute();
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(recompute);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [games.length]);

  // Total tiles = covers + (overflow indicator if it exists). When overflow
  // exists it consumes one tile slot, so we show (maxTiles - 1) covers.
  const totalTiles = Math.min(games.length, maxTiles);
  const showOverflow = games.length > totalTiles;
  const visibleCount = showOverflow ? totalTiles - 1 : totalTiles;
  const visibleCovers = games.slice(0, Math.max(0, visibleCount));
  const overflow = games.length - visibleCovers.length;

  return (
    <Link
      href="/catalog"
      className="group border-border bg-secondary/30 hover:bg-secondary/50 block rounded-xl border p-3 pb-4 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gamepad2
            strokeWidth={1.5}
            className="group-hover:text-primary h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-colors"
          />
          <span className="text-foreground text-sm font-medium">Game Library</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-tertiary)] tabular-nums">
            {games.length} game{games.length !== 1 ? "s" : ""}
          </span>
          <span className="group-hover:text-primary text-[11px] text-[var(--text-tertiary)] transition-colors">
            Add Games →
          </span>
        </div>
      </div>

      {games.length > 0 && (
        <div ref={coverRowRef} className="mt-3 flex items-center">
          {visibleCovers.map((game, i) => {
            // 1-2 games (and no overflow): side by side with 6px gap.
            // Otherwise: -10px overlap with descending z-index so the leftmost
            // is on top.
            const compact = !showOverflow && visibleCovers.length <= 2;
            const style = compact
              ? i > 0
                ? { marginLeft: COMPACT_GAP_PX }
                : undefined
              : { marginLeft: i === 0 ? 0 : -OVERLAP_PX, zIndex: 100 - i };
            return (
              <div key={game.id} className={`bg-secondary ${COVER_BOX}`} style={style}>
                {game.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={game.thumbnail_url}
                    alt={game.title}
                    width={40}
                    height={40}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--surface-hover)]">
                    <span className="text-muted-foreground text-[10px] font-medium uppercase">
                      {game.title.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          {showOverflow && (
            <div
              className={`flex items-center justify-center bg-white/[0.08] ${COVER_BOX}`}
              style={{
                marginLeft: visibleCovers.length === 0 ? 0 : -OVERLAP_PX,
                zIndex: 100 - visibleCovers.length,
              }}
            >
              <span className="text-[11px] font-medium text-[var(--text-secondary)] tabular-nums">
                +{overflow}
              </span>
            </div>
          )}
        </div>
      )}

      {playingGameTitle && (
        <div className="mt-2.5 flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="bg-primary relative inline-flex h-2 w-2 rounded-full" />
          </span>
          <span className="truncate text-xs">
            <span className="text-[var(--text-disabled)]">from </span>
            <span className="text-foreground font-medium">{playingGameTitle}</span>
          </span>
        </div>
      )}

      {!isLoading && games.length === 0 && (
        <p className="mt-2 text-xs text-[var(--text-disabled)]">
          No active games — add and enable some to get started.
        </p>
      )}
    </Link>
  );
}
