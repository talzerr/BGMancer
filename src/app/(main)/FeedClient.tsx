"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlaylistTrack } from "@/types";
import Script from "next/script";
import Image from "next/image";
import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
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
import { clearPlaybackState } from "@/hooks/player/playback-state";
import { clearGuestLibrary } from "@/lib/guest-library";
import { useTurnstileToken } from "@/hooks/shared/useTurnstileToken";
import { GenerateSection } from "@/components/GenerateSection";
import { SessionList } from "@/components/session/SessionList";
import { LibraryWidget } from "@/components/library/LibraryWidget";
import { PlaylistHeader } from "@/components/session/PlaylistHeader";
import { SortableTrackItem } from "@/components/player/SortableTrackItem";
import { Launchpad } from "@/components/launchpad/Launchpad";
import { UndoToast } from "@/components/player/UndoToast";
import { PlayerPanel } from "@/components/player/PlayerPanel";
import { AuthButtons } from "@/components/AuthButtons";

const LAUNCHPAD_FADE_MS = 700;
const LAUNCHPAD_SWAP_DELAY_MS = 800; // fade-out duration + brief held-at-zero pause
const PLAYLIST_FADE_MS = 300;

interface FeedClientProps {
  isSignedIn: boolean;
  isDev: boolean;
  turnstileSiteKey?: string;
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
}

function LogoLink() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <Image
        src="/icon-192.png"
        alt="BGMancer"
        width={20}
        height={20}
        className="h-5 w-5 shrink-0"
        priority
      />
      <h1 className="font-display text-foreground text-[14px] leading-[1.2] font-semibold -tracking-[0.03em]">
        BGMancer
      </h1>
    </Link>
  );
}

export function FeedClient({ isSignedIn, isDev, turnstileSiteKey, user }: FeedClientProps) {
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
    if (!hydrated) setHydrated(true);
  }, [hydrated]);

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
    clearPlaybackState();
    clearGuestLibrary();
    signOut({ callbackUrl: "/" }).then(() => window.location.reload());
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
            {/* Minimal header for launchpad */}
            <header className="mx-auto flex max-w-7xl items-center justify-between px-4 pt-[18px] sm:px-6">
              <LogoLink />
              <AuthButtons user={user} isDev={isDev} />
            </header>
            <Launchpad pressedCurate={pressedCurate} onCurateClick={handleLaunchpadCurate} />
          </>
        ) : (
          <>
            {/* Mobile header (hidden on desktop) */}
            <header className="flex items-center justify-between px-4 pt-[18px] sm:px-6 lg:hidden">
              <LogoLink />
              <AuthButtons user={user} isDev={isDev} />
            </header>

            <div className="flex flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
              {/* Left sidebar — curation */}
              <aside className="flex flex-col gap-4 p-4 lg:w-[290px] lg:shrink-0 lg:border-r lg:border-[rgba(255,255,255,0.04)] lg:p-5 lg:pb-16">
                {/* Logo (desktop only) */}
                <div className="mb-3 hidden lg:block">
                  <LogoLink />
                </div>

                {sidebarControls}

                {/* Spacer — pushes history + user info to bottom on desktop */}
                <div className="hidden lg:block lg:flex-1" />

                {sessionList}

                {/* User info / sign-in + footer links (desktop only) */}
                <div className="mt-2 hidden flex-col gap-2 border-t border-[rgba(255,255,255,0.04)] pt-3 lg:flex">
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
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      Sign in with Google
                    </button>
                  )}
                  <div className="flex items-center gap-1 text-[11px] text-[var(--text-disabled)]">
                    <a
                      href="https://github.com/talzerr/bgmancer"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-[var(--text-tertiary)]"
                    >
                      Source
                    </a>
                    <span>·</span>
                    <Link
                      href="/legal"
                      className="transition-colors hover:text-[var(--text-tertiary)]"
                    >
                      Legal
                    </Link>
                    <span>·</span>
                    <span>Discord: talzxc</span>
                  </div>
                </div>
              </aside>

              {/* Center — scrollable playlist */}
              <main
                className="playlist-scroll min-w-0 flex-1 lg:overflow-y-auto"
                style={{ scrollbarColor: "rgba(255,255,255,0.12) transparent" }}
              >
                <div className="px-4 pb-4 sm:px-6 lg:px-8">{playlistContent}</div>
              </main>

              {/* Right — player panel (desktop only) */}
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
