import { steamHeaderUrl } from "@/lib/constants";
import type { Game } from "@/types";

interface CatalogHeaderBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  libraryGames: Game[];
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}

const MAX_AVATARS = 5;

export function CatalogHeaderBar({
  search,
  onSearchChange,
  libraryGames,
  drawerOpen,
  onToggleDrawer,
}: CatalogHeaderBarProps) {
  const visibleGames = libraryGames.slice(0, MAX_AVATARS);
  const overflow = libraryGames.length - MAX_AVATARS;

  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
      {/* Left: search input */}
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Filter games..."
        className="w-[180px] rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-600 focus:ring-0"
      />

      {/* Right: library preview + drawer toggle */}
      <button
        type="button"
        onClick={onToggleDrawer}
        className="flex items-center gap-2 rounded px-1 py-0.5 transition-colors hover:bg-zinc-800/60"
      >
        {/* Avatar stack */}
        {libraryGames.length > 0 && (
          <div className="flex -space-x-1.5">
            {visibleGames.map((game) => (
              <div
                key={game.id}
                className="h-5 w-5 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-700"
              >
                {game.steam_appid ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={steamHeaderUrl(game.steam_appid)}
                    alt={game.title}
                    className="h-full w-full object-cover"
                  />
                ) : game.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={game.thumbnail_url}
                    alt={game.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-zinc-700" />
                )}
              </div>
            ))}
            {overflow > 0 && (
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800">
                <span className="text-[9px] font-medium text-zinc-400 tabular-nums">
                  +{overflow}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Game count */}
        <span className="text-xs text-violet-300">
          {libraryGames.length > 0 ? `${libraryGames.length} games` : "No games yet"}
        </span>

        {/* Chevron */}
        <span className="text-xs text-zinc-500">{drawerOpen ? "◂" : "▸"}</span>
      </button>
    </div>
  );
}
