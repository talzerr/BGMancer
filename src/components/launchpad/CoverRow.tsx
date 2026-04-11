"use client";

import type { Game } from "@/types";

const COVER_ROW_MAX = 6;
const COVER_BOX = "h-[48px] w-[48px] shrink-0 overflow-hidden rounded-[6px]";

export function CoverRow({ games }: { games: Game[] }) {
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
