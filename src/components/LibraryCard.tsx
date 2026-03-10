import Link from "next/link";
import { usePlayerContext } from "@/context/player-context";
import { steamHeaderUrl } from "@/lib/constants";

export function LibraryCard() {
  const { gameLibrary, player, playlist } = usePlayerContext();
  const { games, gamesLoading } = gameLibrary;

  const playingGameTitle =
    playlist.tracks.find((t) => t.id === player.playingTrackId)?.game_title ?? null;

  return (
    <Link
      href="/library"
      className="group block rounded-2xl border border-white/[0.07] bg-zinc-900/70 p-4 shadow-lg shadow-black/40 backdrop-blur-sm transition-all hover:border-teal-500/30 hover:bg-zinc-900/90"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 shrink-0 text-teal-400"
          >
            <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3A1.5 1.5 0 0 1 13 3.5V5h1.5A2.5 2.5 0 0 1 17 7.5v5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 3 12.5v-5A2.5 2.5 0 0 1 5.5 5H7V3.5ZM8.5 3.5v2h3v-2h-3ZM7 6.5H5.5A1 1 0 0 0 4.5 7.5v5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H7ZM7 9a.75.75 0 0 1 .75.75v.5h.5a.75.75 0 0 1 0 1.5h-.5v.5a.75.75 0 0 1-1.5 0v-.5H5.75a.75.75 0 0 1 0-1.5h.5v-.5A.75.75 0 0 1 7 9Zm5.25.75a.75.75 0 0 0-1.5 0v2.5a.75.75 0 0 0 1.5 0v-2.5Z" />
          </svg>
          <span className="text-sm font-semibold text-white">Game Library</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 tabular-nums">
            {games.length} game{games.length !== 1 ? "s" : ""}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3.5 w-3.5 text-zinc-600 transition-colors group-hover:text-teal-400"
          >
            <path
              fillRule="evenodd"
              d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {games.length > 0 && (
        <div className="mt-3 flex items-center">
          <div className="flex -space-x-2">
            {games.slice(0, 5).map((game) => (
              <div
                key={game.id}
                className="h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 border-zinc-900 bg-zinc-800"
              >
                {game.steam_appid ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={steamHeaderUrl(game.steam_appid as number)}
                    alt={game.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-700">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase">
                      {game.title.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
          {games.length > 5 && (
            <span className="ml-2 text-[11px] text-zinc-500 tabular-nums">
              +{games.length - 5} more
            </span>
          )}
        </div>
      )}

      {playingGameTitle && (
        <div className="mt-2.5 flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            {player.isPlayerPlaying && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
            )}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
          </span>
          <span className="truncate text-xs">
            <span className="text-zinc-600">From </span>
            <span className="font-medium text-zinc-300">{playingGameTitle}</span>
          </span>
        </div>
      )}

      {!gamesLoading && games.length === 0 && (
        <p className="mt-2 text-xs text-zinc-600">
          No active games — add and enable some to get started.
        </p>
      )}
    </Link>
  );
}
