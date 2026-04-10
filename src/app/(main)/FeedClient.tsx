"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlaylistTrack } from "@/types";
import Script from "next/script";
import { signIn } from "next-auth/react";
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
import { useSessionManager } from "@/hooks/library/useSessionManager";
import { useTrackDeleteUndo } from "@/hooks/player/useTrackDeleteUndo";
import { useTurnstileToken } from "@/hooks/shared/useTurnstileToken";
import { GenerateSection } from "@/components/GenerateSection";
import { SessionList } from "@/components/session/SessionList";
import { LibraryWidget } from "@/components/library/LibraryWidget";
import { PlaylistHeader } from "@/components/session/PlaylistHeader";
import { SortableTrackItem } from "@/components/player/SortableTrackItem";
import { Launchpad } from "@/components/launchpad/Launchpad";
import { UndoToast } from "@/components/player/UndoToast";
import { PlayerPanel } from "@/components/player/PlayerPanel";
import { AuthButtons, performSignOut } from "@/components/AuthButtons";
import { LogoLink } from "@/components/layout/LogoLink";
import { FooterLinks } from "@/components/layout/FooterLinks";
import { GoogleLogo } from "@/components/Icons";
import { useGameAccentColors } from "@/hooks/player/useGameAccentColors";

const LAUNCHPAD_FADE_MS = 700;
const LAUNCHPAD_SWAP_DELAY_MS = 800; // fade-out duration + brief held-at-zero pause
const PLAYLIST_FADE_MS = 300;

interface FeedClientProps {
  isSignedIn: boolean;
  isDev: boolean;
  turnstileSiteKey?: string;
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
  previewCovers: string[];
}

export function FeedClient({
  isSignedIn,
  isDev,
  turnstileSiteKey,
  user,
  previewCovers,
}: FeedClientProps) {
  const { playlist, player, config, gameLibrary, gameThumbnailByGameId, media } =
    usePlayerContext();
  const { sessions, fetchSessions, handleRenameSession, handleDeleteSession } = useSessionManager();
  const { pendingDelete, initiateRemove, undoRemove } = useTrackDeleteUndo();

  const [pressedCurate, setPressedCurate] = useState(false);
  const [mode, setMode] = useState<"launchpad" | "playlist">(() =>
    playlist.tracks.length > 0 ? "playlist" : "launchpad",
  );
  const [fadeOpacity, setFadeOpacity] = useState(1);
  // Tracks whether the client has hydrated. During SSR the server can't read
  // localStorage, so guests with cached playlists see a flash of launchpad.
  // We hide guest content until hydration completes to prevent the flash.
  const [hydrated, setHydrated] = useState(isSignedIn);
  // True once the user has pressed Curate from the launchpad in this mount.
  // Distinguishes the curate-driven transition (cross-fade) from data-driven
  // mode flips like the cache restore (snap, no fade).
  const hasCuratedRef = useRef(false);

  // Snapshot of the playlist currently rendered. Lags behind playlist.tracks
  // during a session swap so we can fade out the old data before it changes.
  const [displayedSnapshot, setDisplayedSnapshot] = useState<{
    sessionId: string | null;
    tracks: PlaylistTrack[];
  }>(() => ({
    sessionId: playlist.currentSessionId,
    tracks: playlist.tracks,
  }));
  const [playlistOpacity, setPlaylistOpacity] = useState(1);
  // Marks the next session swap as a generation completion → use the
  // crossfade. History clicks (`loadForSession`) leave this false → snap.
  const fadeOnNextSwapRef = useRef(false);
  const wasGeneratingRef = useRef(playlist.generating);

  // Detect generation completion: generating transitioned true → false.
  useEffect(() => {
    if (wasGeneratingRef.current && !playlist.generating) {
      fadeOnNextSwapRef.current = true;
    }
    wasGeneratingRef.current = playlist.generating;
  }, [playlist.generating]);

  useEffect(() => {
    const nextSessionId = playlist.currentSessionId;
    const nextTracks = playlist.tracks;

    // Same session — keep tracks in sync (reorder, reroll, in-place removal).
    if (nextSessionId === displayedSnapshot.sessionId) {
      if (nextTracks !== displayedSnapshot.tracks) {
        setDisplayedSnapshot({ sessionId: nextSessionId, tracks: nextTracks });
      }
      return;
    }

    // No new session yet, or empty incoming — leave the snapshot as-is.
    if (!nextSessionId || nextTracks.length === 0) return;

    // First mount with data, or no previous snapshot, or this swap was
    // triggered by a history click (not a generation) → snap.
    const shouldFade =
      fadeOnNextSwapRef.current &&
      !!displayedSnapshot.sessionId &&
      displayedSnapshot.tracks.length > 0;
    fadeOnNextSwapRef.current = false;

    if (!shouldFade) {
      setDisplayedSnapshot({ sessionId: nextSessionId, tracks: nextTracks });
      setPlaylistOpacity(1);
      return;
    }

    // Generation completed → fade out, swap, fade in.
    setPlaylistOpacity(0);
    const swapTimer = setTimeout(() => {
      setDisplayedSnapshot({ sessionId: nextSessionId, tracks: nextTracks });
      requestAnimationFrame(() => setPlaylistOpacity(1));
    }, PLAYLIST_FADE_MS);
    return () => clearTimeout(swapTimer);
    // displayedSnapshot is intentionally in its own deps: we read it to decide
    // whether to snap or fade, but the early-returns above prevent loops.
  }, [playlist.currentSessionId, playlist.tracks, displayedSnapshot]);

  const targetMode: "launchpad" | "playlist" =
    playlist.tracks.length > 0 ? "playlist" : "launchpad";

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (targetMode === mode) return;
    if (!hasCuratedRef.current) {
      // Data-driven change (cache restore landing after first paint).
      // Snap without replaying the launchpad → playlist fade.
      setMode(targetMode);
      setFadeOpacity(1);
      return;
    }
    setFadeOpacity(0);
    const swapTimer = setTimeout(() => {
      setMode(targetMode);
      requestAnimationFrame(() => setFadeOpacity(1));
    }, LAUNCHPAD_SWAP_DELAY_MS);
    return () => clearTimeout(swapTimer);
  }, [targetMode, mode]);

  const {
    containerRef: turnstileContainerRef,
    scriptOnReady: turnstileScriptOnReady,
    getToken: getTurnstileToken,
  } = useTurnstileToken(turnstileSiteKey);

  async function handleGenerate() {
    const turnstileToken = !isSignedIn ? await getTurnstileToken() : undefined;

    await playlist.handleGenerate(gameLibrary.games, {
      target_track_count: config.targetTrackCount,
      allow_long_tracks: config.allowLongTracks,
      allow_short_tracks: config.allowShortTracks,
      anti_spoiler_enabled: config.antiSpoilerEnabled,
      raw_vibes: config.rawVibes,
      turnstileToken,
      gameSelections: !isSignedIn
        ? gameLibrary.games.map((g) => ({ gameId: g.id, curation: g.curation }))
        : undefined,
    });
    await fetchSessions();
  }

  async function handleLaunchpadCurate() {
    hasCuratedRef.current = true;
    setPressedCurate(true);
    try {
      await handleGenerate();
    } finally {
      setPressedCurate(false);
    }
  }

  useEffect(() => {
    if (!playlist.generating) {
      void (async () => {
        await fetchSessions();
      })();
    }
  }, [playlist.generating, fetchSessions]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const displayedTracks = displayedSnapshot.tracks;

  const accentGameInputs = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of playlist.tracks) {
      if (!seen.has(t.game_id) && t.game_thumbnail_url) {
        seen.set(t.game_id, t.game_thumbnail_url);
      }
    }
    return Array.from(seen, ([gameId, url]) => ({ gameId, url }));
  }, [playlist.tracks]);

  const accentColors = useGameAccentColors(accentGameInputs);
  const trackIds = useMemo(() => displayedTracks.map((t) => t.id), [displayedTracks]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = displayedTracks.findIndex((t) => t.id === active.id);
    const newIndex = displayedTracks.findIndex((t) => t.id === over.id);
    playlist.reorderTracks(arrayMove(displayedTracks, oldIndex, newIndex).map((t) => t.id));
  }

  // Stable callbacks for memo'd SortableTrackItem. The hook/context functions
  // aren't memoized, so we pin current values via refs to keep callback
  // identity stable across renders.
  const trackCallbackRefs = useRef({
    player,
    playlist,
    initiateRemove,
    config,
    displayedSnapshot,
    media,
  });
  trackCallbackRefs.current = {
    player,
    playlist,
    initiateRemove,
    config,
    displayedSnapshot,
    media,
  };

  const handleTrackPlay = useCallback((trackId: string, index: number) => {
    const { player: p, displayedSnapshot: snap, media: m } = trackCallbackRefs.current;
    if (p.playingTrackId === trackId) {
      m?.togglePlayPause();
    } else {
      p.startPlaying(snap.tracks, index, snap.sessionId);
    }
  }, []);

  const handleTrackRemove = useCallback((track: PlaylistTrack) => {
    trackCallbackRefs.current.initiateRemove(track);
  }, []);

  const handleTrackReroll = useCallback((trackId: string) => {
    const { playlist: pl, config: c } = trackCallbackRefs.current;
    pl.rerollTrack(trackId, c.allowLongTracks, c.allowShortTracks);
  }, []);

  function handleSignOut() {
    performSignOut();
  }

  // ── Sidebar content (shared between mobile stacked + desktop fixed) ──
  const sidebarControls = (
    <>
      <LibraryWidget />

      <GenerateSection
        generating={playlist.generating}
        genError={playlist.genError}
        cooldownUntil={playlist.cooldownUntil}
        targetTrackCount={config.targetTrackCount}
        onTargetSave={config.saveTrackCount}
        gamesCount={gameLibrary.games.length}
        games={gameLibrary.games}
        onGenerate={handleGenerate}
        allowLongTracks={config.allowLongTracks}
        onToggleLongTracks={config.saveAllowLongTracks}
        allowShortTracks={config.allowShortTracks}
        onToggleShortTracks={config.saveAllowShortTracks}
        rawVibes={config.rawVibes}
        onToggleRawVibes={config.saveRawVibes}
      />
    </>
  );

  const sessionList = isSignedIn ? (
    <SessionList
      sessions={sessions.map((s) =>
        s.id === playlist.currentSessionId ? { ...s, track_count: playlist.tracks.length } : s,
      )}
      selectedId={playlist.currentSessionId}
      onSelect={(id) => {
        playlist.loadForSession(id);
      }}
      onDelete={handleDeleteSession}
    />
  ) : null;

  // ── Playlist content ──
  const playlistContent =
    playlist.isLoading || displayedTracks.length === 0 ? null : (
      <div
        className="flex flex-col gap-0"
        style={{
          opacity: playlistOpacity,
          transition: `opacity ${PLAYLIST_FADE_MS}ms cubic-bezier(0.25, 0.1, 0.25, 1)`,
          pointerEvents: playlistOpacity === 0 ? "none" : "auto",
        }}
      >
        <PlaylistHeader
          sessions={sessions}
          currentSessionId={displayedSnapshot.sessionId}
          tracks={displayedTracks}
          isSignedIn={isSignedIn}
          isDev={isDev}
          onRename={handleRenameSession}
          onDeleteSession={handleDeleteSession}
        />
        <DndContext
          id="playlist-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={trackIds} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-0 pb-4">
              {(() => {
                const viewingPlayingSession =
                  player.playingSessionId === displayedSnapshot.sessionId;
                return displayedTracks.map((track, i) => {
                  const isCurrentTrack =
                    viewingPlayingSession && track.id === player.playingTrackId;
                  const spoilerHidden =
                    config.antiSpoilerEnabled &&
                    !player.playedTrackIds.has(track.id) &&
                    track.id !== player.playingTrackId;

                  const prevTrack = i > 0 ? displayedTracks[i - 1] : null;
                  const phaseGap =
                    i > 0 &&
                    track.arc_phase != null &&
                    prevTrack?.arc_phase != null &&
                    track.arc_phase !== prevTrack.arc_phase;

                  return (
                    <SortableTrackItem
                      key={track.id}
                      track={track}
                      index={i}
                      gameThumbnail={gameThumbnailByGameId.get(track.game_id)}
                      accentColor={accentColors.get(track.game_id)}
                      phaseGap={phaseGap}
                      isPlaying={isCurrentTrack}
                      isActivelyPlaying={isCurrentTrack && player.isPlayerPlaying}
                      spoilerHidden={spoilerHidden}
                      isRerolling={playlist.rerollingIds.has(track.id)}
                      onPlay={handleTrackPlay}
                      onRemove={handleTrackRemove}
                      onReroll={handleTrackReroll}
                    />
                  );
                });
              })()}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    );

  return (
    <>
      {!isSignedIn && turnstileSiteKey && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="afterInteractive"
            onReady={turnstileScriptOnReady}
          />
          <div ref={turnstileContainerRef} className="hidden" />
        </>
      )}
      <div
        className="transition-opacity ease-in-out"
        style={{
          opacity: hydrated ? fadeOpacity : 0,
          transitionDuration: `${LAUNCHPAD_FADE_MS}ms`,
        }}
      >
        {mode === "launchpad" ? (
          <>
            <header className="flex items-center justify-between px-4 pt-4 sm:px-6 lg:px-5">
              <LogoLink />
              <AuthButtons user={user} isDev={isDev} hidePrompt />
            </header>
            <Launchpad
              pressedCurate={pressedCurate}
              onCurateClick={handleLaunchpadCurate}
              previewCovers={previewCovers}
            />
          </>
        ) : (
          <>
            <header className="flex items-center justify-between px-4 pt-4 sm:px-6 lg:hidden">
              <LogoLink />
              <AuthButtons user={user} isDev={isDev} />
            </header>

            <div className="flex flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
              <aside className="lg:border-border flex flex-col gap-4 p-4 lg:w-[290px] lg:shrink-0 lg:border-r lg:p-5 lg:pb-16">
                <div className="mb-3 hidden lg:block">
                  <LogoLink />
                </div>

                {sidebarControls}

                <div className="hidden lg:block lg:flex-1" />

                {sessionList}

                <div className="border-border mt-2 hidden flex-col gap-2 border-t pt-3 lg:flex">
                  {user ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[var(--text-disabled)]">
                        {user.email?.split("@")[0] ?? "User"}
                      </span>
                      <button
                        onClick={handleSignOut}
                        className="cursor-pointer text-[11px] text-[rgba(255,255,255,0.20)] transition-colors hover:text-[var(--text-tertiary)]"
                      >
                        Sign out
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => signIn("google", { callbackUrl: "/" })}
                      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[rgba(255,255,255,0.08)] bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-white/[0.08] hover:text-[var(--text-primary)]"
                    >
                      <GoogleLogo className="h-3.5 w-3.5" />
                      Sign in with Google
                    </button>
                  )}
                  <FooterLinks />
                </div>
              </aside>

              <main
                className="playlist-scroll min-w-0 flex-1 lg:overflow-y-auto"
                style={{ scrollbarColor: "rgba(255,255,255,0.12) transparent" }}
              >
                <div className="px-4 pb-4 sm:px-6 lg:px-8">{playlistContent}</div>
              </main>

              <div className="hidden lg:flex">
                <PlayerPanel />
              </div>
            </div>
          </>
        )}
      </div>

      {pendingDelete && <UndoToast track={pendingDelete.track} onUndo={undoRemove} />}
    </>
  );
}
