import { useRef, useState, useEffect } from "react";
import { usePlayerContext } from "@/context/player-context";
import { SyncButton } from "@/components/SyncButton";
import { Spinner, SearchIcon, CheckIcon, EyeIcon, EyeOffIcon, PlayIcon } from "@/components/Icons";
import { SESSION_NAME_MAX_LENGTH } from "@/lib/constants";
import { formatSessionName } from "@/components/SessionList";
import { TrackStatus } from "@/types";
import type { PlaylistSessionWithCount } from "@/types";

interface PlaylistHeaderProps {
  sessions: PlaylistSessionWithCount[];
  isSignedIn: boolean;
  authConfigured: boolean;
  onRename: (id: string, name: string) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function PlaylistHeader({
  sessions,
  isSignedIn,
  authConfigured,
  onRename,
  onDeleteSession,
}: PlaylistHeaderProps) {
  const { playlist, config, player } = usePlayerContext();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleEditValue, setTitleEditValue] = useState("");
  const titleInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize the textarea to fit its content when it first appears.
  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      const el = titleInputRef.current;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [editingTitle]);

  if (!playlist.currentSessionId) return null;

  const pendingCount = playlist.tracks.filter((t) => t.status === TrackStatus.Pending).length;
  const foundCount = playlist.tracks.filter((t) => t.status === TrackStatus.Found).length;
  const errorCount = playlist.tracks.filter((t) => t.status === TrackStatus.Error).length;
  const hasFoundTracks = foundCount > 0;

  const totalDurationSeconds = playlist.tracks
    .filter((t) => t.status === TrackStatus.Found)
    .reduce((sum, t) => sum + (t.duration_seconds ?? 0), 0);

  const currentSession = sessions.find((s) => s.id === playlist.currentSessionId);

  return (
    <div className="flex flex-col gap-2">
      {/* Editable title — full width */}
      {editingTitle ? (
        <textarea
          ref={titleInputRef}
          value={titleEditValue}
          rows={1}
          onChange={(e) => {
            setTitleEditValue(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onBlur={() => {
            setEditingTitle(false);
            const trimmed = titleEditValue.trim();
            const original = currentSession ? formatSessionName(currentSession.name) : "";
            if (trimmed && trimmed !== original && playlist.currentSessionId) {
              void onRename(playlist.currentSessionId, trimmed);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") setEditingTitle(false);
          }}
          maxLength={SESSION_NAME_MAX_LENGTH}
          className="font-display -mx-2 -my-1 w-[calc(100%+1rem)] resize-none overflow-hidden border-b border-violet-500 bg-transparent px-2 py-1 text-2xl leading-snug font-semibold break-words text-white caret-violet-400 focus:outline-none"
        />
      ) : (
        <button
          onClick={() => {
            if (!currentSession) return;
            setTitleEditValue(formatSessionName(currentSession.name));
            setEditingTitle(true);
            setTimeout(() => titleInputRef.current?.select(), 0);
          }}
          className="group font-display -mx-2 -my-1 flex w-full min-w-0 cursor-text items-start gap-1.5 rounded-lg px-2 py-1 text-2xl font-semibold text-white transition-colors hover:bg-zinc-800/70"
        >
          <span className="min-w-0 flex-1 leading-snug break-words">
            {formatSessionName(currentSession?.name ?? "")}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="mt-0.5 h-3 w-3 shrink-0 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.263a1.75 1.75 0 0 0 0-2.474ZM4.75 13.5c-.69 0-1.25-.56-1.25-1.25V4.75A1.25 1.25 0 0 1 4.75 3.5H8a.75.75 0 0 0 0-1.5H4.75A2.75 2.75 0 0 0 2 4.75v7.5A2.75 2.75 0 0 0 4.75 15h7.5A2.75 2.75 0 0 0 15 12.25V9a.75.75 0 0 0-1.5 0v3.25c0 .69-.56 1.25-1.25 1.25h-7.5Z" />
          </svg>
        </button>
      )}

      {/* Sub-row: stats (left) + actions (right) */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {/* Stats */}
        {playlist.tracks.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-semibold text-white tabular-nums">
              {playlist.tracks.length}
            </span>
            <span className="text-xs text-zinc-500">
              track{playlist.tracks.length !== 1 ? "s" : ""}
            </span>
            {foundCount > 0 && (
              <>
                <span className="text-xs text-zinc-700">·</span>
                <span className="flex items-center gap-1.5 text-xs">
                  <CheckIcon className="h-3 w-3 text-emerald-400" />
                  <span className="font-display text-sm font-semibold text-emerald-400 tabular-nums">
                    {foundCount}
                  </span>
                  <span className="text-zinc-500">ready</span>
                </span>
                {totalDurationSeconds > 0 && (
                  <>
                    <span className="text-xs text-zinc-700">·</span>
                    <span className="font-display text-sm font-semibold text-orange-400 tabular-nums">
                      {formatDuration(totalDurationSeconds)}
                    </span>
                  </>
                )}
              </>
            )}
            {pendingCount > 0 && (
              <>
                <span className="text-xs text-zinc-700">·</span>
                <span className="flex items-center gap-1 text-xs">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  <span className="font-semibold text-amber-400 tabular-nums">{pendingCount}</span>
                  <span className="text-zinc-500">pending</span>
                </span>
              </>
            )}
            {errorCount > 0 && (
              <>
                <span className="text-xs text-zinc-700">·</span>
                <span className="flex items-center gap-1 text-xs">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                  <span className="font-semibold text-red-400 tabular-nums">{errorCount}</span>
                  <span className="text-zinc-500">error{errorCount !== 1 ? "s" : ""}</span>
                </span>
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2">
          {foundCount > 0 && (
            <button
              onClick={() => {
                const viewedFoundTracks = playlist.tracks.filter((t) => t.status === "found");
                player.startPlaying(viewedFoundTracks, 0, playlist.currentSessionId);
              }}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-violet-500/25 transition-all hover:bg-violet-500 hover:shadow-violet-500/40 active:scale-95"
            >
              <PlayIcon className="h-3 w-3" />
              Play All
            </button>
          )}

          {pendingCount > 0 && (
            <button
              onClick={playlist.handleFindVideos}
              disabled={playlist.searching}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/[0.06] bg-zinc-800/80 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {playlist.searching ? (
                <>
                  <Spinner className="h-3 w-3" />
                  Searching…
                </>
              ) : (
                <>
                  <SearchIcon className="h-3 w-3 text-amber-400" />
                  Find Missing ({pendingCount})
                </>
              )}
            </button>
          )}

          {authConfigured && (
            <SyncButton
              isSignedIn={isSignedIn}
              authConfigured={authConfigured}
              hasFoundTracks={hasFoundTracks}
              onSyncComplete={() => {}}
            />
          )}

          {playlist.tracks.length > 0 && (
            <>
              <div className="group/spoiler relative">
                <button
                  onClick={() => config.saveAntiSpoiler(!config.antiSpoilerEnabled)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                    config.antiSpoilerEnabled
                      ? "border-violet-500/40 bg-violet-900/40 text-violet-300 hover:bg-violet-900/60"
                      : "border-white/[0.06] bg-zinc-800/60 text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300"
                  }`}
                >
                  {config.antiSpoilerEnabled ? (
                    <EyeOffIcon className="h-3.5 w-3.5" />
                  ) : (
                    <EyeIcon className="h-3.5 w-3.5" />
                  )}
                  Spoilers
                </button>
                <div className="pointer-events-none absolute right-0 bottom-full z-50 mb-1.5 w-52 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 opacity-0 shadow-xl shadow-black/50 transition-opacity group-hover/spoiler:opacity-100">
                  <p className="text-xs font-medium text-zinc-200">
                    Anti-Spoiler Mode {config.antiSpoilerEnabled ? "(on)" : "(off)"}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">
                    Blurs track names and thumbnails until you&apos;ve played them. Great for blind
                    runs or discovering an OST fresh.
                  </p>
                </div>
              </div>

              {playlist.confirmClear ? (
                <>
                  <span className="text-xs text-zinc-500">Delete this session?</span>
                  <div className="group/confirm-delete relative">
                    <button
                      onClick={() => {
                        playlist.setConfirmClear(false);
                        if (playlist.currentSessionId) {
                          void onDeleteSession(playlist.currentSessionId);
                        }
                      }}
                      className="cursor-pointer rounded-lg bg-red-600/90 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-500"
                    >
                      Yes, delete
                    </button>
                    <div className="pointer-events-none absolute right-0 bottom-full z-50 mb-1.5 w-48 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 opacity-0 shadow-xl shadow-black/50 transition-opacity group-hover/confirm-delete:opacity-100">
                      <p className="text-xs font-medium text-red-400">Permanently deleted</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">
                        This session and all its tracks will be removed. This cannot be undone.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => playlist.setConfirmClear(false)}
                    className="cursor-pointer rounded-lg bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <div className="group/delete relative">
                  <button
                    onClick={() => playlist.setConfirmClear(true)}
                    className="cursor-pointer text-xs text-zinc-600 hover:text-red-400"
                  >
                    Delete
                  </button>
                  <div className="pointer-events-none absolute right-0 bottom-full z-50 mb-1.5 w-44 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 opacity-0 shadow-xl shadow-black/50 transition-opacity group-hover/delete:opacity-100">
                    <p className="text-xs font-medium text-zinc-200">Delete session</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">
                      Removes this playlist and all its tracks. You&apos;ll be asked to confirm.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
