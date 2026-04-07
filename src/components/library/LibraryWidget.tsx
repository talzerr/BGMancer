import Link from "next/link";
import { usePlayerContext } from "@/context/player-context";
import { steamHeaderUrl } from "@/lib/constants";

export function LibraryWidget() {
  const { gameLibrary, player, playlist } = usePlayerContext();
  const { games, isLoading } = gameLibrary;

  const playingGameTitle =
    playlist.tracks.find((t) => t.id === player.playingTrackId)?.game_title ?? null;

  return (
    <Link
      href="/catalog"
      className="group border-border bg-secondary/30 hover:bg-secondary/50 block rounded-xl border p-3 pb-4 transition-all hover:border-[var(--border-emphasis)]"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="text-primary h-4 w-4 shrink-0"
          >
            <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3A1.5 1.5 0 0 1 13 3.5V5h1.5A2.5 2.5 0 0 1 17 7.5v5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 3 12.5v-5A2.5 2.5 0 0 1 5.5 5H7V3.5ZM8.5 3.5v2h3v-2h-3ZM7 6.5H5.5A1 1 0 0 0 4.5 7.5v5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H7ZM7 9a.75.75 0 0 1 .75.75v.5h.5a.75.75 0 0 1 0 1.5h-.5v.5a.75.75 0 0 1-1.5 0v-.5H5.75a.75.75 0 0 1 0-1.5h.5v-.5A.75.75 0 0 1 7 9Zm5.25.75a.75.75 0 0 0-1.5 0v2.5a.75.75 0 0 0 1.5 0v-2.5Z" />
          </svg>
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
        <div className="mt-3 flex items-center">
          <div className="flex -space-x-2">
            {games.slice(0, 5).map((game) => (
              <div
                key={game.id}
                className="border-background bg-secondary h-7 w-7 shrink-0 overflow-hidden rounded-full border-2"
              >
                {game.steam_appid ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={steamHeaderUrl(game.steam_appid as number)}
                    alt={game.title}
                    width={28}
                    height={28}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--surface-hover)]">
                    <span className="text-muted-foreground text-[9px] font-medium uppercase">
                      {game.title.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
          {games.length > 5 && (
            <span className="ml-2 text-[11px] text-[var(--text-tertiary)] tabular-nums">
              +{games.length - 5} more
            </span>
          )}
          <div className="bg-secondary/50 group-hover:border-primary/50 group-hover:text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--border-emphasis)] transition-colors">
            <span className="group-hover:text-primary text-xs leading-none text-[var(--text-tertiary)]">
              +
            </span>
          </div>
        </div>
      )}

      {playingGameTitle && (
        <div className="mt-2.5 flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="bg-primary relative inline-flex h-2 w-2 rounded-full" />
          </span>
          <span className="truncate text-xs">
            <span className="text-[var(--text-disabled)]">From </span>
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
