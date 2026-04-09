import { useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { usePlayerContext } from "@/context/player-context";
import { SESSION_NAME_MAX_LENGTH } from "@/lib/constants";
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
  const displayTitle = currentSession ? formatSessionName(currentSession.name) : "";

  if (!currentSessionId) return null;

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
    <div>
      <div className="flex items-center justify-between pb-[14px]">
        {/* Left: title + metadata */}
        <div className="flex min-w-0 items-center gap-3">
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
              className="border-primary caret-primary min-w-0 flex-1 border-b bg-transparent text-[15px] font-medium -tracking-[0.01em] text-[var(--text-secondary)] focus:outline-none"
            />
          ) : (
            <button
              onClick={() => {
                if (!currentSession) return;
                setTitleEditValue(displayTitle);
                setEditingTitle(true);
                setTimeout(() => titleInputRef.current?.select(), 0);
              }}
              className="min-w-0 cursor-text truncate text-[15px] font-medium -tracking-[0.01em] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              {displayTitle}
            </button>
          )}
          {trackCount > 0 && (
            <span className="shrink-0 text-[12px] text-[var(--text-disabled)] tabular-nums">
              {trackCount} tracks · {formatDuration(totalDurationSeconds)}
            </span>
          )}
        </div>

        {/* Right: text link actions */}
        {trackCount > 0 && (
          <div className="flex shrink-0 items-center gap-[14px]">
            <button
              onClick={() => player.startPlaying(tracks, 0, currentSessionId)}
              className="text-primary cursor-pointer text-[12px] font-medium transition-colors hover:text-[var(--primary-hover)]"
            >
              Play All
            </button>

            {isSignedIn && !isDev && (
              <button
                onClick={() => void handleSync()}
                disabled={syncing}
                className="cursor-pointer text-[12px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {syncing ? "Syncing…" : "Sync"}
              </button>
            )}

            <button
              onClick={toggleAntiSpoiler}
              className={`cursor-pointer text-[12px] transition-colors ${
                config.antiSpoilerEnabled
                  ? "text-primary font-medium"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}
            >
              Spoilers
            </button>

            {playlist.confirmClear ? (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[var(--text-tertiary)]">Delete?</span>
                <button
                  onClick={() => {
                    playlist.setConfirmClear(false);
                    if (currentSessionId) {
                      void onDeleteSession(currentSessionId);
                    }
                  }}
                  className="cursor-pointer text-[12px] text-red-400 transition-colors hover:text-red-300"
                >
                  Yes
                </button>
                <button
                  onClick={() => playlist.setConfirmClear(false)}
                  className="cursor-pointer text-[12px] text-[var(--text-tertiary)]"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => playlist.setConfirmClear(true)}
                className="cursor-pointer text-[12px] text-[var(--text-disabled)] transition-colors hover:text-[var(--text-tertiary)]"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
      <div className="mb-5 h-px bg-[rgba(255,255,255,0.06)]" />
    </div>
  );
}
