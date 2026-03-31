"use client";

import { useEffect, useMemo } from "react";
import type { SyntheticEvent } from "react";
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
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { usePlayerContext } from "@/context/player-context";
import { useSessionManager } from "@/hooks/useSessionManager";
import { useTrackDeleteUndo } from "@/hooks/useTrackDeleteUndo";
import { GenerateSection } from "@/components/GenerateSection";
import { SessionList } from "@/components/SessionList";
import { LibraryWidget } from "@/components/LibraryWidget";
import { PlaylistHeader } from "@/components/PlaylistHeader";
import { SortableTrackItem } from "@/components/SortableTrackItem";
import { PlaylistEmptyState } from "@/components/PlaylistEmptyState";
import { UndoToast } from "@/components/UndoToast";

interface FeedClientProps {
  isSignedIn: boolean;
  authConfigured: boolean;
}

export function FeedClient({ isSignedIn, authConfigured }: FeedClientProps) {
  const { playlist, player, config, gameLibrary, gameThumbnailByGameId } = usePlayerContext();
  const { sessions, fetchSessions, handleRenameSession, handleDeleteSession } = useSessionManager();
  const { pendingDelete, initiateRemove, undoRemove } = useTrackDeleteUndo();

  // ── Cross-hook action coordinators ────────────────────────────────────────

  async function handleGenerate() {
    await playlist.handleGenerate(gameLibrary.games, {
      target_track_count: config.targetTrackCount,
      allow_long_tracks: config.allowLongTracks,
      allow_short_tracks: config.allowShortTracks,
      anti_spoiler_enabled: config.antiSpoilerEnabled,
      raw_vibes: config.rawVibes,
    });
    await fetchSessions();
  }

  async function handleImport(e: SyntheticEvent<HTMLFormElement>) {
    const success = await playlist.handleImport(e);
    if (success) {
      await fetchSessions();
    }
  }

  // Re-fetch sessions after generate/import settle (playlist hook updates async).
  useEffect(() => {
    if (!playlist.generating && !playlist.importing) {
      void (async () => {
        await fetchSessions();
      })();
    }
    // Intentionally omit fetchSessions — it's stable and never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist.generating, playlist.importing]);

  // ── DnD ──────────────────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[320px_1fr] lg:gap-8">
        {/* Left panel */}
        <aside className="flex flex-col gap-4 p-4 lg:sticky lg:top-[57px] lg:pl-0">
          <LibraryWidget />

          <GenerateSection
            generating={playlist.generating}
            genProgress={playlist.genProgress}
            genGlobalMsg={playlist.genGlobalMsg}
            genError={playlist.genError}
            cooldownUntil={playlist.cooldownUntil}
            targetTrackCount={config.targetTrackCount}
            onTargetChange={config.setTargetTrackCount}
            onTargetSave={config.saveTrackCount}
            gamesCount={gameLibrary.games.length}
            onGenerate={handleGenerate}
            allowLongTracks={config.allowLongTracks}
            onToggleLongTracks={config.saveAllowLongTracks}
            allowShortTracks={config.allowShortTracks}
            onToggleShortTracks={config.saveAllowShortTracks}
            rawVibes={config.rawVibes}
            onToggleRawVibes={config.saveRawVibes}
            importUrl={playlist.importUrl}
            onImportUrlChange={playlist.setImportUrl}
            importing={playlist.importing}
            importError={playlist.importError}
            onImport={handleImport}
          />

          <SessionList
            sessions={sessions.map((s) =>
              s.id === playlist.currentSessionId
                ? { ...s, track_count: playlist.tracks.length }
                : s,
            )}
            selectedId={playlist.currentSessionId}
            onSelect={(id) => {
              playlist.loadForSession(id);
            }}
            onDelete={handleDeleteSession}
          />
        </aside>

        {/* Right panel: Playlist */}
        <main className="flex flex-col gap-4">
          <PlaylistHeader
            sessions={sessions}
            isSignedIn={isSignedIn}
            authConfigured={authConfigured}
            onRename={handleRenameSession}
            onDeleteSession={handleDeleteSession}
          />

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
              onImportUrlChange={(url) => playlist.setImportUrl(url)}
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
                <div className="flex flex-col gap-1 pb-24">
                  {(() => {
                    const viewingPlayingSession =
                      player.playingSessionId === playlist.currentSessionId;
                    const viewedFoundTracks = playlist.tracks.filter((t) => t.status === "found");
                    return playlist.tracks.map((track, i) => {
                      const isCurrentTrack =
                        viewingPlayingSession && track.id === player.playingTrackId;
                      const foundIdx = viewedFoundTracks.findIndex((ft) => ft.id === track.id);
                      const spoilerHidden =
                        config.antiSpoilerEnabled &&
                        track.status === "found" &&
                        !player.playedTrackIds.has(track.id);
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
                            foundIdx !== -1
                              ? () => {
                                  if (isCurrentTrack) {
                                    player.playerBarRef.current?.togglePlayPause();
                                  } else {
                                    player.startPlaying(
                                      viewedFoundTracks,
                                      foundIdx,
                                      playlist.currentSessionId,
                                    );
                                  }
                                }
                              : undefined
                          }
                          onRemove={() => initiateRemove(track)}
                          onReroll={() =>
                            playlist.rerollTrack(
                              track.id,
                              config.allowLongTracks,
                              config.allowShortTracks,
                            )
                          }
                        />
                      );
                    });
                  })()}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </main>
      </div>

      {pendingDelete && <UndoToast track={pendingDelete.track} onUndo={undoRemove} />}
    </>
  );
}
