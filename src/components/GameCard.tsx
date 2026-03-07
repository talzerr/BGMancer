"use client";

import { useState } from "react";
import Image from "next/image";
import type { Game } from "@/types";
import { VIBE_LABELS } from "@/types";

interface GameCardProps {
  game: Game;
  onCurate: (gameId: string) => Promise<void>;
  onDelete: (gameId: string) => void;
  isCurating: boolean;
}

const STATUS_CONFIG = {
  pending: { label: "Pending", className: "bg-zinc-700 text-zinc-300" },
  searching: { label: "Searching…", className: "bg-amber-500/20 text-amber-300 animate-pulse" },
  found: { label: "Found", className: "bg-emerald-500/20 text-emerald-300" },
  synced: { label: "Synced", className: "bg-violet-500/20 text-violet-300" },
  error: { label: "Error", className: "bg-red-500/20 text-red-400" },
};

export function GameCard({ game, onCurate, onDelete, isCurating }: GameCardProps) {
  const [showThinking, setShowThinking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const statusConfig = STATUS_CONFIG[game.status] ?? STATUS_CONFIG.pending;
  const hasVideo = !!game.current_video_id;
  const hasQueries = game.search_queries && game.search_queries.length > 0;

  return (
    <div className="group relative flex flex-col rounded-xl bg-zinc-800/60 border border-zinc-700/50 overflow-hidden hover:border-zinc-600 transition-all duration-200">

      {/* Thumbnail */}
      <div className="relative aspect-video bg-zinc-900 overflow-hidden">
        {hasVideo && game.video_thumbnail ? (
          <a
            href={`https://www.youtube.com/watch?v=${game.current_video_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full h-full"
          >
            <Image
              src={game.video_thumbnail}
              alt={game.video_title ?? game.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-black/60 rounded-full p-3">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </a>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-3 p-4 flex-1">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate">{game.title}</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              {VIBE_LABELS[game.vibe_preference] ?? game.vibe_preference}
            </p>
          </div>
          <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${statusConfig.className}`}>
            {statusConfig.label}
          </span>
        </div>

        {/* Video info */}
        {hasVideo && game.video_title && (
          <div className="rounded-lg bg-zinc-900/60 px-3 py-2">
            <p className="text-xs font-medium text-zinc-200 line-clamp-2">{game.video_title}</p>
            {game.channel_title && (
              <p className="text-xs text-zinc-500 mt-0.5">{game.channel_title}</p>
            )}
          </div>
        )}

        {/* Error message */}
        {game.status === "error" && game.error_message && (
          <p className="text-xs text-red-400 rounded-lg bg-red-500/10 px-3 py-2">
            {game.error_message}
          </p>
        )}

        {/* Agent Thinking section */}
        {hasQueries && (
          <div>
            <button
              onClick={() => setShowThinking((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <svg
                className={`w-3 h-3 transition-transform ${showThinking ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Agent Thinking ({game.search_queries!.length} queries)
            </button>

            {showThinking && (
              <ol className="mt-2 space-y-1.5 pl-4">
                {game.search_queries!.map((q, i) => (
                  <li key={i} className="text-xs text-zinc-400">
                    <span className="text-zinc-600 mr-1.5">{i + 1}.</span>
                    <span className="font-mono text-zinc-300">&quot;{q}&quot;</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto pt-1">
          <button
            onClick={() => onCurate(game.id)}
            disabled={isCurating || game.status === "searching"}
            className="flex-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 text-xs font-medium text-white transition cursor-pointer"
          >
            {isCurating || game.status === "searching"
              ? "Searching…"
              : hasVideo
              ? "Refresh"
              : "Find OST"}
          </button>

          {confirmDelete ? (
            <>
              <button
                onClick={() => onDelete(game.id)}
                className="rounded-lg bg-red-600 hover:bg-red-500 px-3 py-2 text-xs font-medium text-white transition cursor-pointer"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg bg-zinc-700 hover:bg-zinc-600 px-3 py-2 text-xs font-medium text-zinc-300 transition cursor-pointer"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg bg-zinc-700/50 hover:bg-red-500/20 hover:text-red-400 px-3 py-2 text-xs font-medium text-zinc-500 transition cursor-pointer"
              title="Delete game"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
