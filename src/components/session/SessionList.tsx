"use client";

import { useState } from "react";
import type { PlaylistSessionWithCount } from "@/types";
import { MAX_PLAYLIST_SESSIONS } from "@/lib/constants";

interface SessionListProps {
  sessions: PlaylistSessionWithCount[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatSessionName(name: string): string {
  return name;
}

export function SessionList({ sessions, selectedId, onSelect, onDelete }: SessionListProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5 border-t border-white/[0.06] pt-4">
      <div className="flex items-center gap-1.5 px-1">
        <span className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
          Playlist History
        </span>
        {sessions.length > 0 && (
          <span className="text-[10px] font-medium text-[var(--text-disabled)] tabular-nums">
            {sessions.length}/{MAX_PLAYLIST_SESSIONS}
          </span>
        )}
        {/* Info tooltip */}
        <div className="group relative ml-0.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3 w-3 cursor-default text-[var(--text-disabled)] hover:text-[var(--text-tertiary)]"
          >
            <path
              fillRule="evenodd"
              d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0Zm-6 3.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7.293 5.293a1 1 0 1 1 .99 1.667A.999.999 0 0 0 7.5 8a.75.75 0 0 0 1.5 0 2.5 2.5 0 1 0-2.197-3.707.75.75 0 1 0 1.046 1.074 1 1 0 0 1 .444-.074Z"
              clipRule="evenodd"
            />
          </svg>
          <div className="bg-secondary pointer-events-none absolute bottom-full left-0 z-10 mb-2 w-52 rounded-lg border border-[var(--border-emphasis)] px-3 py-2 opacity-0 transition-opacity group-hover:opacity-100">
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
              Up to {MAX_PLAYLIST_SESSIONS} playlists are kept. The oldest is replaced when a new
              one is curated.
            </p>
          </div>
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="px-1 py-2 text-[11px] text-[var(--text-disabled)]">
          No playlists yet — curate or import one to get started.
        </p>
      ) : null}

      <div className="flex flex-col gap-0.5">
        {sessions.map((session) => {
          const isSelected = session.id === selectedId;
          const isConfirming = confirmDeleteId === session.id;

          return (
            <div
              key={session.id}
              onClick={() => {
                if (!isConfirming) {
                  setConfirmDeleteId(null);
                  onSelect(session.id);
                }
              }}
              className={`session-row-enter group relative flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors ${
                isSelected
                  ? "bg-secondary/80 ring-1 ring-[var(--border-default)]"
                  : "hover:bg-secondary/50"
              }`}
            >
              {/* Selection indicator */}
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                  isSelected ? "bg-primary" : "bg-[var(--text-disabled)]"
                }`}
              />

              {/* Session info */}
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-xs leading-tight font-medium ${
                    isSelected ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {formatSessionName(session.name)}
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--text-disabled)] tabular-nums">
                  {session.track_count} track{session.track_count !== 1 ? "s" : ""}
                  <span className="mx-1 text-[var(--text-disabled)]">·</span>
                  {formatRelativeDate(session.created_at)}
                </p>
              </div>

              {/* Delete / confirm */}
              {isConfirming ? (
                <div
                  className="flex shrink-0 items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setConfirmDeleteId(null);
                      onDelete(session.id);
                    }}
                    className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-medium text-red-400 hover:bg-red-500/20"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(session.id);
                    }}
                    className="cursor-pointer rounded p-0.5 text-[var(--text-disabled)] hover:text-red-400"
                    title="Delete session"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="h-3 w-3"
                    >
                      <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
