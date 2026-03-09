"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { SyntheticEvent } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useGameLibrary } from "@/hooks/useGameLibrary";
import { useConfig } from "@/hooks/useConfig";
import { usePlayerContext } from "@/context/player-context";
import { GenerateSection } from "@/components/GenerateSection";
import { SessionList, formatSessionName } from "@/components/SessionList";
import { PlaylistTrackCard } from "@/components/PlaylistTrackCard";
import { PlaylistEmptyState } from "@/components/PlaylistEmptyState";
import { SyncButton } from "@/components/SyncButton";
import { DevPanel } from "@/components/DevPanel";
import { Spinner, SearchIcon, CheckIcon, EyeIcon, EyeOffIcon } from "@/components/Icons";
import type { PlaylistSessionWithCount, PlaylistTrack } from "@/types";

interface FeedClientProps {
  isSignedIn: boolean;
  authConfigured: boolean;
}

// ── Sortable wrapper for each track card ────────────────────────────────────

interface SortableTrackItemProps {
  track: PlaylistTrack;
  index: number;
  gameThumbnail?: string;
  isPlaying: boolean;
  isActivelyPlaying: boolean;
  spoilerHidden: boolean;
  isRerolling: boolean;
  onPlay?: () => void;
  onRemove: () => void;
  onReroll: () => void;
}

function SortableTrackItem({
  track,
  index,
  gameThumbnail,
  isPlaying,
  isActivelyPlaying,
  spoilerHidden,
  isRerolling,
  onPlay,
  onRemove,
  onReroll,
}: SortableTrackItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? "relative" : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <PlaylistTrackCard
        track={track}
        index={index}
        gameThumbnail={gameThumbnail}
        isPlaying={isPlaying}
        isActivelyPlaying={isActivelyPlaying}
        spoilerHidden={spoilerHidden}
        isRerolling={isRerolling}
        onPlay={onPlay}
        onRemove={onRemove}
        onReroll={onReroll}
        dragHandleProps={{ ...listeners, ...attributes }}
        isDragging={isDragging}
      />
    </div>
  );
}

// ── Main feed component ─────────────────────────────────────────────────────

export function FeedClient({ isSignedIn, authConfigured }: FeedClientProps) {
  const gameLibrary = useGameLibrary();
  const config = useConfig();
  const { playlist, player } = usePlayerContext();
  const [playedTrackIds, setPlayedTrackIds] = useState<Set<string>>(new Set());
  const [sessions, setSessions] = useState<PlaylistSessionWithCount[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleEditValue, setTitleEditValue] = useState("");
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const [pendingTrackDelete, setPendingTrackDelete] = useState<{
    track: PlaylistTrack;
    position: number;
  } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markPlayed = useCallback((id: string) => {
    setPlayedTrackIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) setSessions(await res.json());
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    }
  }, []);

  // Initial data fetches.
  const { fetchGames } = gameLibrary;
  useEffect(() => {
    void (async () => {
      await fetchGames();
      await fetchSessions();
    })();
  }, [fetchGames, fetchSessions]);

  // ── Cross-hook action coordinators ──────────────────────────────────────────

  async function handleGenerate() {
    player.reset();
    setPlayedTrackIds(new Set());
    await playlist.handleGenerate(gameLibrary.games);
    await fetchSessions();
  }

  async function handleRenameSession(id: string, name: string) {
    try {
      await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    } catch (err) {
      console.error("Failed to rename session:", err);
    }
  }

  async function handleDeleteSession(id: string) {
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      const { nextSessionId } = await res.json();
      if (player.playingTrackId) {
        const isFromDeletedSession = playlist.tracks.some((t) => t.id === player.playingTrackId);
        if (isFromDeletedSession) player.reset();
      }
      setPlayedTrackIds(new Set());
      if (nextSessionId) {
        await playlist.loadForSession(nextSessionId);
      } else {
        // No sessions left — clear the track list.
        await playlist.loadForSession("");
      }
      await fetchSessions();
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  }

  function initiateRemoveTrack(track: PlaylistTrack) {
    // Commit any already-pending deletion immediately before starting a new one
    if (pendingTrackDelete) {
      void fetch(`/api/playlist/${pendingTrackDelete.track.id}`, { method: "DELETE" });
    }
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    if (track.id === player.playingTrackId) player.reset();
    const position = playlist.tracks.findIndex((t) => t.id === track.id);
    playlist.removeTrackLocal(track.id);
    setPendingTrackDelete({ track, position });

    undoTimerRef.current = setTimeout(() => {
      void fetch(`/api/playlist/${track.id}`, { method: "DELETE" });
      setPendingTrackDelete(null);
    }, 4000);
  }

  function undoRemoveTrack() {
    if (!pendingTrackDelete) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    playlist.restoreTrackLocal(pendingTrackDelete.track, pendingTrackDelete.position);
    setPendingTrackDelete(null);
  }

  async function handleImport(e: SyntheticEvent<HTMLFormElement>) {
    const success = await playlist.handleImport(e);
    if (success) {
      player.reset();
      setPlayedTrackIds(new Set());
      await fetchSessions();
    }
  }

  // ── DnD ────────────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const trackIds = useMemo(() => playlist.tracks.map((t) => t.id), [playlist.tracks]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = playlist.tracks.findIndex((t) => t.id === active.id);
    const newIndex = playlist.tracks.findIndex((t) => t.id === over.id);
    playlist.reorderTracks(arrayMove(playlist.tracks, oldIndex, newIndex).map((t) => t.id));
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const pendingCount = playlist.tracks.filter((t) => t.status === "pending").length;
  const foundCount = playlist.tracks.filter((t) => t.status === "found").length;
  const errorCount = playlist.tracks.filter((t) => t.status === "error").length;
  const hasFoundTracks = foundCount > 0;

  const gameThumbnailByGameId = new Map(
    gameLibrary.games
      .filter((g) => g.steam_appid)
      .map((g) => [
        g.id,
        `https://cdn.akamai.steamstatic.com/steam/apps/${g.steam_appid}/header.jpg`,
      ]),
  );

  const playingGameTitle =
    playlist.tracks.find((t) => t.id === player.playingTrackId)?.game_title ?? null;

  const totalDurationSeconds = playlist.tracks
    .filter((t) => t.status === "found")
    .reduce((sum, t) => sum + (t.duration_seconds ?? 0), 0);

  function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[340px_1fr]">
        {/* ── Left panel ──────────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
          <GenerateSection
            generating={playlist.generating}
            genProgress={playlist.genProgress}
            genGlobalMsg={playlist.genGlobalMsg}
            genError={playlist.genError}
            targetTrackCount={config.targetTrackCount}
            onTargetChange={config.setTargetTrackCount}
            onTargetSave={config.saveTrackCount}
            gamesCount={gameLibrary.games.length}
            onGenerate={handleGenerate}
            allowLongTracks={config.allowLongTracks}
            onToggleLongTracks={config.saveAllowLongTracks}
          />

          <SessionList
            sessions={sessions.map((s) =>
              s.id === playlist.currentSessionId
                ? { ...s, track_count: playlist.tracks.length }
                : s,
            )}
            selectedId={playlist.currentSessionId}
            onSelect={(id) => {
              setPlayedTrackIds(new Set());
              playlist.loadForSession(id);
            }}
            onDelete={handleDeleteSession}
          />

          <Link
            href="/library"
            className="group block rounded-2xl border border-white/[0.07] bg-zinc-900/70 p-4 shadow-lg shadow-black/40 backdrop-blur-sm transition-all hover:border-white/[0.14] hover:bg-zinc-900/90"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-white tabular-nums">
                  {gameLibrary.games.length}
                </span>
                <span className="ml-1.5 text-sm text-zinc-500">
                  active game{gameLibrary.games.length !== 1 ? "s" : ""}
                </span>
              </div>
              <span className="text-xs font-medium text-zinc-600 transition-colors group-hover:text-teal-400">
                Manage Library →
              </span>
            </div>

            {/* Game cover avatars */}
            {gameLibrary.games.length > 0 && (
              <div className="mt-3 flex items-center">
                <div className="flex -space-x-2">
                  {gameLibrary.games.slice(0, 5).map((game) => (
                    <div
                      key={game.id}
                      className="h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 border-zinc-900 bg-zinc-800 ring-0"
                    >
                      {game.steam_appid ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`https://cdn.akamai.steamstatic.com/steam/apps/${game.steam_appid}/header.jpg`}
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
                {gameLibrary.games.length > 5 && (
                  <span className="ml-2 text-[11px] text-zinc-500 tabular-nums">
                    +{gameLibrary.games.length - 5} more
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
            {!gameLibrary.gamesLoading && gameLibrary.games.length === 0 && (
              <p className="mt-2 text-xs text-zinc-600">
                No active games — add and enable some to get started.
              </p>
            )}
          </Link>
        </aside>

        {/* ── Right panel: Playlist ────────────────────────────────────────── */}
        <main className="flex flex-col gap-4">
          {/* Playlist header */}
          {playlist.currentSessionId && (
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
                    if (trimmed && playlist.currentSessionId) {
                      void handleRenameSession(playlist.currentSessionId, trimmed);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                    if (e.key === "Escape") setEditingTitle(false);
                  }}
                  maxLength={60}
                  className="-mx-2 -my-1 w-[calc(100%+1rem)] resize-none overflow-hidden border-b border-teal-500 bg-transparent px-2 py-1 text-xl leading-snug font-semibold text-white caret-teal-400 focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => {
                    const current = sessions.find((s) => s.id === playlist.currentSessionId);
                    if (!current) return;
                    setTitleEditValue(formatSessionName(current.name));
                    setEditingTitle(true);
                    setTimeout(() => titleInputRef.current?.select(), 0);
                  }}
                  className="group -mx-2 -my-1 flex w-full min-w-0 cursor-text items-start gap-1.5 rounded-lg px-2 py-1 text-xl font-semibold text-white transition-colors hover:bg-zinc-800/70"
                >
                  <span className="leading-snug break-words">
                    {formatSessionName(
                      sessions.find((s) => s.id === playlist.currentSessionId)?.name ?? "",
                    )}
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
                    <span className="text-xs font-semibold text-white tabular-nums">
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
                          <span className="font-semibold text-emerald-400 tabular-nums">
                            {foundCount}
                          </span>
                          <span className="text-zinc-500">ready</span>
                        </span>
                        {totalDurationSeconds > 0 && (
                          <>
                            <span className="text-xs text-zinc-700">·</span>
                            <span className="text-xs font-semibold text-orange-400 tabular-nums">
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
                          <span className="font-semibold text-amber-400 tabular-nums">
                            {pendingCount}
                          </span>
                          <span className="text-zinc-500">pending</span>
                        </span>
                      </>
                    )}
                    {errorCount > 0 && (
                      <>
                        <span className="text-xs text-zinc-700">·</span>
                        <span className="flex items-center gap-1 text-xs">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                          <span className="font-semibold text-red-400 tabular-nums">
                            {errorCount}
                          </span>
                          <span className="text-zinc-500">error{errorCount !== 1 ? "s" : ""}</span>
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="ml-auto flex items-center gap-2">
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
                      <button
                        onClick={() => config.saveAntiSpoiler(!config.antiSpoilerEnabled)}
                        title={
                          config.antiSpoilerEnabled
                            ? "Anti-Spoiler: On — click to disable"
                            : "Anti-Spoiler: Off — click to enable"
                        }
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

                      {playlist.confirmClear ? (
                        <>
                          <span className="text-xs text-zinc-500">Delete this session?</span>
                          <button
                            onClick={() => {
                              playlist.setConfirmClear(false);
                              if (playlist.currentSessionId)
                                handleDeleteSession(playlist.currentSessionId);
                            }}
                            className="cursor-pointer rounded-lg bg-red-600/90 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-500"
                          >
                            Yes, delete
                          </button>
                          <button
                            onClick={() => playlist.setConfirmClear(false)}
                            className="cursor-pointer rounded-lg bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-700"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => playlist.setConfirmClear(true)}
                          className="cursor-pointer text-xs text-zinc-600 hover:text-red-400"
                        >
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Track list */}
          {playlist.tracksLoading ? (
            <div className="space-y-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[52px] animate-pulse rounded-xl bg-zinc-900/50"
                  style={{ opacity: 1 - i * 0.12 }}
                />
              ))}
            </div>
          ) : playlist.tracks.length === 0 ? (
            <PlaylistEmptyState
              gamesLength={gameLibrary.games.length}
              importUrl={playlist.importUrl}
              onImportUrlChange={(url) => {
                playlist.setImportUrl(url);
              }}
              importing={playlist.importing}
              importError={playlist.importError}
              onImport={handleImport}
            />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={trackIds} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-1.5 pb-24">
                  {playlist.tracks.map((track, i) => {
                    const effectiveIdx = player.effectiveFoundTracks.findIndex(
                      (ft) => ft.id === track.id,
                    );
                    const isCurrentTrack = track.id === player.playingTrackId;
                    const spoilerHidden =
                      config.antiSpoilerEnabled &&
                      track.status === "found" &&
                      !playedTrackIds.has(track.id);
                    return (
                      <SortableTrackItem
                        key={track.id}
                        track={track}
                        index={i}
                        gameThumbnail={gameThumbnailByGameId.get(track.game_id)}
                        isPlaying={isCurrentTrack}
                        isActivelyPlaying={isCurrentTrack && player.isPlayerPlaying}
                        spoilerHidden={spoilerHidden}
                        isRerolling={playlist.rerollingIds.has(track.id)}
                        onPlay={
                          effectiveIdx !== -1
                            ? () => {
                                markPlayed(track.id);
                                if (isCurrentTrack) {
                                  player.playerBarRef.current?.togglePlayPause();
                                } else {
                                  player.setCurrentTrackIndex(effectiveIdx);
                                }
                              }
                            : undefined
                        }
                        onRemove={() => initiateRemoveTrack(track)}
                        onReroll={() => playlist.rerollTrack(track.id)}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </main>
      </div>

      {/* ── Dev panel ───────────────────────────────────────────────────────── */}
      <DevPanel />

      {/* ── Undo toast ──────────────────────────────────────────────────────── */}
      {pendingTrackDelete && (
        <div className="fixed right-4 bottom-24 z-50 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-zinc-900 px-4 py-2.5 shadow-2xl shadow-black/60">
          <span className="text-sm text-zinc-300">
            <span className="font-medium text-white">
              {pendingTrackDelete.track.track_name ??
                pendingTrackDelete.track.video_title ??
                "Track"}
            </span>{" "}
            removed
          </span>
          <div className="h-3.5 w-px bg-zinc-700" />
          <button
            onClick={undoRemoveTrack}
            className="cursor-pointer text-sm font-semibold text-teal-400 hover:text-teal-300"
          >
            Undo
          </button>
          {/* Countdown bar — key forces remount so animation restarts on each new deletion */}
          <div className="absolute right-0 bottom-0 left-0 h-0.5 overflow-hidden rounded-b-xl bg-zinc-800">
            <div
              key={pendingTrackDelete.track.id}
              className="h-full animate-[shrink_4s_linear_forwards] bg-teal-500"
              style={{ transformOrigin: "left" }}
            />
          </div>
        </div>
      )}
    </>
  );
}
