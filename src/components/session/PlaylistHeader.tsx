import { useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { usePlayerContext } from "@/context/player-context";
import { EyeIcon, EyeOffIcon } from "@/components/Icons";
import { SESSION_NAME_MAX_LENGTH, buildSessionName } from "@/lib/constants";
import { formatSessionName } from "@/components/session/SessionList";
import type { PlaylistSessionWithCount, PlaylistTrack } from "@/types";

interface PlaylistHeaderProps {
  sessions: PlaylistSessionWithCount[];
  currentSessionId: string | null;
  tracks: PlaylistTrack[];
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

const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube";

export function PlaylistHeader({
  sessions,
  currentSessionId,
  tracks,
  isSignedIn,
  isDev,
  onRename,
  onDeleteSession,
}: PlaylistHeaderProps) {
  const { playlist, config, player, toggleAntiSpoiler } = usePlayerContext();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleEditValue, setTitleEditValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [syncing, setSyncing] = useState(false);

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  // For guests (no session), derive a deterministic title from game names
  const displayTitle = currentSession
    ? formatSessionName(currentSession.name)
    : buildSessionName(tracks.map((t) => t.game_title ?? t.game_id));

  if (tracks.length === 0) return null;

  const trackCount = tracks.length;
  const totalDurationSeconds = tracks.reduce((sum, t) => sum + (t.duration_seconds ?? 0), 0);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (res.status === 401) {
        signIn(
          "google",
          { callbackUrl: window.location.pathname },
          { scope: `openid email ${YOUTUBE_SCOPE}` },
        );
        return;
      }
      const data = (await res.json()) as { playlist_url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      if (data.playlist_url) {
        window.open(data.playlist_url, "_blank", "noopener,noreferrer");
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="sticky top-0 z-10 -mx-4 bg-[#13120f] px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-col gap-1.5 pt-6 pb-[14px]">
        {/* First line: title left, actions right */}
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            {editingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={titleEditValue}
                onChange={(e) => setTitleEditValue(e.target.value)}
                onBlur={() => {
                  setEditingTitle(false);
                  const trimmed = titleEditValue.trim();
                  if (trimmed && trimmed !== displayTitle && currentSessionId) {
                    void onRename(currentSessionId, trimmed);
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
                className="font-display border-primary caret-primary w-full border-b bg-transparent text-[16px] font-semibold -tracking-[0.03em] text-[var(--text-primary)] focus:outline-none"
              />
            ) : isSignedIn ? (
              <button
                onClick={() => {
                  if (!currentSession) return;
                  setTitleEditValue(displayTitle);
                  setEditingTitle(true);
                  setTimeout(() => titleInputRef.current?.select(), 0);
                }}
                className="font-display hover:text-foreground max-w-full min-w-0 cursor-text truncate text-[16px] font-semibold -tracking-[0.03em] text-[var(--text-primary)] transition-colors"
              >
                {displayTitle}
              </button>
            ) : (
              <span className="font-display max-w-full min-w-0 truncate text-[16px] font-semibold -tracking-[0.03em] text-[var(--text-primary)]">
                {displayTitle}
              </span>
            )}
          </div>

          {trackCount > 0 && (
            <div className="flex shrink-0 items-center gap-[14px]">
              <button
                onClick={() => player.startPlaying(tracks, 0, currentSessionId)}
                className="text-primary cursor-pointer text-[13px] font-medium transition-colors hover:text-[var(--primary-hover)]"
              >
                Play All
              </button>

              {isSignedIn && !isDev && (
                <button
                  onClick={() => void handleSync()}
                  disabled={syncing}
                  className="cursor-pointer text-[13px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {syncing ? "Syncing…" : "Sync"}
                </button>
              )}

              <button
                onClick={toggleAntiSpoiler}
                className={`flex cursor-pointer items-center gap-1 text-[13px] transition-colors ${
                  config.antiSpoilerEnabled
                    ? "text-primary font-medium"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {config.antiSpoilerEnabled ? (
                  <EyeOffIcon className="h-3.5 w-3.5" />
                ) : (
                  <EyeIcon className="h-3.5 w-3.5" />
                )}
                Spoilers
              </button>

              {isSignedIn &&
                (playlist.confirmClear ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[var(--text-tertiary)]">Delete?</span>
                    <button
                      onClick={() => {
                        playlist.setConfirmClear(false);
                        if (currentSessionId) {
                          void onDeleteSession(currentSessionId);
                        }
                      }}
                      className="cursor-pointer text-[13px] text-red-400 transition-colors hover:text-red-300"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => playlist.setConfirmClear(false)}
                      className="cursor-pointer text-[13px] text-[var(--text-tertiary)]"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => playlist.setConfirmClear(true)}
                    className="cursor-pointer text-[13px] text-[var(--text-disabled)] transition-colors hover:text-[var(--text-tertiary)]"
                  >
                    Delete
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Second line: metadata */}
        {trackCount > 0 && (
          <span className="text-[12px] text-[var(--text-disabled)] tabular-nums">
            {trackCount} tracks · {formatDuration(totalDurationSeconds)}
          </span>
        )}
      </div>
      <div className="mb-5 h-px bg-[rgba(255,255,255,0.06)]" />
    </div>
  );
}
