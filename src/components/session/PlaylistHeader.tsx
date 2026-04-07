import { useRef, useState, useEffect } from "react";
import { usePlayerContext } from "@/context/player-context";
import { SyncButton } from "@/components/SyncButton";
import { EyeIcon, EyeOffIcon, PlayIcon, TrashIcon } from "@/components/Icons";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { SESSION_NAME_MAX_LENGTH } from "@/lib/constants";
import { formatSessionName } from "@/components/session/SessionList";
import type { PlaylistSessionWithCount } from "@/types";

interface PlaylistHeaderProps {
  sessions: PlaylistSessionWithCount[];
  isSignedIn: boolean;
  isDev: boolean;
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
  isDev,
  onRename,
  onDeleteSession,
}: PlaylistHeaderProps) {
  const { playlist, config, player, toggleAntiSpoiler } = usePlayerContext();
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

  const trackCount = playlist.tracks.length;
  const hasFoundTracks = trackCount > 0;

  const totalDurationSeconds = playlist.tracks.reduce(
    (sum, t) => sum + (t.duration_seconds ?? 0),
    0,
  );

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
          className="font-display border-primary text-foreground caret-primary -mx-2 -my-1 w-[calc(100%+1rem)] resize-none overflow-hidden border-b bg-transparent px-2 py-1 text-2xl leading-snug font-medium -tracking-[0.03em] break-words focus:outline-none"
        />
      ) : (
        <button
          onClick={() => {
            if (!currentSession) return;
            setTitleEditValue(formatSessionName(currentSession.name));
            setEditingTitle(true);
            setTimeout(() => titleInputRef.current?.select(), 0);
          }}
          className="group font-display text-foreground hover:bg-secondary/70 -mx-2 -my-1 flex w-full min-w-0 cursor-text items-start gap-1.5 rounded-lg px-2 py-1 text-2xl font-medium -tracking-[0.03em] transition-colors"
        >
          <span className="min-w-0 flex-1 leading-snug break-words">
            {formatSessionName(currentSession?.name ?? "")}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="mt-0.5 h-3 w-3 shrink-0 text-[var(--text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100"
          >
            <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.263a1.75 1.75 0 0 0 0-2.474ZM4.75 13.5c-.69 0-1.25-.56-1.25-1.25V4.75A1.25 1.25 0 0 1 4.75 3.5H8a.75.75 0 0 0 0-1.5H4.75A2.75 2.75 0 0 0 2 4.75v7.5A2.75 2.75 0 0 0 4.75 15h7.5A2.75 2.75 0 0 0 15 12.25V9a.75.75 0 0 0-1.5 0v3.25c0 .69-.56 1.25-1.25 1.25h-7.5Z" />
          </svg>
        </button>
      )}

      {/* Sub-row: stats (left) + actions (right) */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {/* Stats */}
        {trackCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="font-display text-foreground text-sm font-medium tabular-nums">
              {trackCount}
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">
              track{trackCount !== 1 ? "s" : ""}
            </span>
            {totalDurationSeconds > 0 && (
              <>
                <span className="text-xs text-[var(--text-disabled)]">·</span>
                <span className="font-display text-primary text-sm font-medium tabular-nums">
                  {formatDuration(totalDurationSeconds)}
                </span>
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <TooltipProvider delay={300}>
          <div className="ml-auto flex items-center gap-1.5">
            {/* Primary actions */}
            {trackCount > 0 && (
              <button
                onClick={() => {
                  player.startPlaying(playlist.tracks, 0, playlist.currentSessionId);
                }}
                className="bg-primary text-foreground flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:bg-[var(--primary-hover)] active:scale-[0.98]"
              >
                <PlayIcon className="h-3 w-3" />
                Play All
              </button>
            )}

            {/* Separator between primary and secondary actions */}
            {trackCount > 0 && <div className="bg-border mx-0.5 h-4 w-px" />}

            {/* Secondary actions */}
            {isSignedIn && !isDev && (
              <SyncButton
                isSignedIn={isSignedIn}
                isDev={isDev}
                hasFoundTracks={hasFoundTracks}
                onSyncComplete={() => {}}
              />
            )}

            {playlist.tracks.length > 0 && (
              <>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        onClick={toggleAntiSpoiler}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                          config.antiSpoilerEnabled
                            ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                            : "border-border bg-secondary/60 hover:text-foreground text-[var(--text-tertiary)] hover:border-[var(--border-emphasis)]"
                        }`}
                      />
                    }
                  >
                    {config.antiSpoilerEnabled ? (
                      <EyeOffIcon className="h-3 w-3" />
                    ) : (
                      <EyeIcon className="h-3 w-3" />
                    )}
                    <span className="hidden sm:inline">Spoilers</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {config.antiSpoilerEnabled ? "Show all tracks" : "Blur unplayed tracks"}
                  </TooltipContent>
                </Tooltip>

                {playlist.confirmClear ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[var(--text-tertiary)]">Delete?</span>
                    <button
                      onClick={() => {
                        playlist.setConfirmClear(false);
                        if (playlist.currentSessionId) {
                          void onDeleteSession(playlist.currentSessionId);
                        }
                      }}
                      className="text-foreground cursor-pointer rounded-lg bg-red-600/90 px-2 py-1 text-xs font-medium hover:bg-red-500"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => playlist.setConfirmClear(false)}
                      className="bg-secondary text-muted-foreground cursor-pointer rounded-lg px-2 py-1 text-xs font-medium hover:bg-[var(--surface-hover)]"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          onClick={() => playlist.setConfirmClear(true)}
                          className="flex cursor-pointer items-center rounded-lg p-1.5 text-[var(--text-disabled)] transition-colors hover:bg-red-500/10 hover:text-red-400"
                        />
                      }
                    >
                      <TrashIcon className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Delete session</TooltipContent>
                  </Tooltip>
                )}
              </>
            )}
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
