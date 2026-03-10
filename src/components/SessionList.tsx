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
  // Strip the auto-generated date prefix ("3/9/2026 – ") to show just the game names.
  const dashIdx = name.indexOf(" – ");
  return dashIdx !== -1 ? name.slice(dashIdx + 3) : name;
}

export function SessionList({ sessions, selectedId, onSelect, onDelete }: SessionListProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (sessions.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-white/[0.07] bg-zinc-900/70 p-3 shadow-lg shadow-black/40 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 px-1">
        <span className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
          Playlist History
        </span>
        <span className="text-[10px] font-medium text-zinc-600 tabular-nums">
          {sessions.length}/{MAX_PLAYLIST_SESSIONS}
        </span>
        {/* Info tooltip */}
        <div className="group relative ml-0.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3 w-3 cursor-default text-zinc-700 hover:text-zinc-500"
          >
            <path
              fillRule="evenodd"
              d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0Zm-6 3.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7.293 5.293a1 1 0 1 1 .99 1.667A.999.999 0 0 0 7.5 8a.75.75 0 0 0 1.5 0 2.5 2.5 0 1 0-2.197-3.707.75.75 0 1 0 1.046 1.074 1 1 0 0 1 .444-.074Z"
              clipRule="evenodd"
            />
          </svg>
          <div className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 w-52 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 opacity-0 shadow-xl shadow-black/50 transition-opacity group-hover:opacity-100">
            <p className="text-xs font-medium text-zinc-200">Playlist History</p>
            <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">
              Each time you curate or import, a new playlist is saved here so you can switch between
              past runs. Up to {MAX_PLAYLIST_SESSIONS} are kept — the oldest is automatically
              removed when a new one is created.
            </p>
          </div>
        </div>
      </div>

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
              className={`group relative flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors ${
                isSelected ? "bg-zinc-800/80 ring-1 ring-white/[0.08]" : "hover:bg-zinc-800/50"
              }`}
            >
              {/* Selection indicator */}
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                  isSelected ? "bg-teal-400" : "bg-zinc-700"
                }`}
              />

              {/* Session info */}
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-xs leading-tight font-medium ${
                    isSelected ? "text-white" : "text-zinc-400"
                  }`}
                >
                  {formatSessionName(session.name)}
                </p>
                <p className="mt-0.5 text-[10px] text-zinc-600 tabular-nums">
                  {session.track_count} track{session.track_count !== 1 ? "s" : ""}
                  <span className="mx-1 text-zinc-700">·</span>
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
                    className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteId(session.id);
                  }}
                  className="shrink-0 cursor-pointer rounded p-0.5 text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
