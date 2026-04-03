"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
  parseSource,
  formatSource,
  sourceUrl,
  getRegisteredSources,
} from "@/lib/services/tracklist-source";
import { parseTracklist, type ParsedTrack } from "@/lib/services/track-parser";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/backstage/StatusBadge";
import { PhaseStepper } from "@/components/backstage/PhaseStepper";
import { SSEProgress } from "@/components/backstage/SSEProgress";
import { EnergyBadge } from "@/components/backstage/EnergyBadge";
import { TagBadgeList } from "@/components/backstage/TagBadgeList";
import { TrackEditSheet } from "@/components/backstage/TrackEditSheet";
import type { PatchUpdates } from "@/components/backstage/TrackEditSheet";
import { ConfirmModal } from "@/components/backstage/ConfirmModal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DiscoveredStatus, OnboardingPhase } from "@/types";
import type { Game, Track } from "@/types";
import type { ReviewFlag } from "@/lib/db/repos/review-flags";

interface VideoDetail {
  videoId: string;
  durationSeconds: number | null;
  viewCount: number | null;
}

interface GameDetailClientProps {
  game: Game;
  tracks: Track[];
  reviewFlags: ReviewFlag[];
  videoMap: Record<string, string>;
  videoDetailMap: Record<string, VideoDetail>;
}

type ActiveModal =
  | "retag"
  | "reingest"
  | "add-track"
  | "import-tracks"
  | "load-tracks"
  | "resolve"
  | "quick-onboard"
  | null;

export function GameDetailClient({
  game,
  tracks,
  reviewFlags,
  videoMap,
  videoDetailMap,
}: GameDetailClientProps) {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [sseRunning, setSseRunning] = useState(false);
  const [newTrackName, setNewTrackName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pastePreview, setPastePreview] = useState<ParsedTrack[]>([]);
  const [reingestRunning, setReingestRunning] = useState(false);
  const [reingestTyped, setReingestTyped] = useState("");
  const [editTrack, setEditTrack] = useState<Track | null>(null);
  const [mutError, setMutError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [nukeOpen, setNukeOpen] = useState(false);
  const [nuking, setNuking] = useState(false);
  const [editingTracks, setEditingTracks] = useState(false);
  const [pendingDeleteTrack, setPendingDeleteTrack] = useState<Track | null>(null);
  const flagsRef = useRef<HTMLDetailsElement>(null);

  // SSE modals set sseRunning when they open, clear on close
  const SSE_MODALS: ActiveModal[] = ["load-tracks", "resolve", "quick-onboard", "retag"];
  useEffect(() => {
    if (activeModal && SSE_MODALS.includes(activeModal)) {
      setSseRunning(true);
    }
  }, [activeModal]); // eslint-disable-line react-hooks/exhaustive-deps

  const trackCount = tracks.filter((t) => t.discovered !== DiscoveredStatus.Rejected).length;
  const activeCount = tracks.filter((t) => t.active).length;
  const taggedCount = tracks.filter((t) => t.taggedAt !== null).length;
  const phase = game.onboarding_phase;
  const thumbnailSrc = game.thumbnail_url;

  function closeReingest() {
    setActiveModal(null);
    setReingestRunning(false);
    setReingestTyped("");
  }

  async function addTrack() {
    if (!newTrackName.trim()) return;
    setMutError(null);
    try {
      const res = await fetch("/api/backstage/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, name: newTrackName.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNewTrackName("");
      setActiveModal(null);
      router.refresh();
    } catch (err) {
      console.error("[GameDetail] addTrack failed:", err);
      setMutError("Failed to add track. Please try again.");
    }
  }

  function handlePasteChange(text: string) {
    setPasteText(text);
    setPastePreview(text.trim() ? parseTracklist(text) : []);
  }

  async function importPastedTracks() {
    if (pastePreview.length === 0) return;
    setMutError(null);
    try {
      const res = await fetch("/api/backstage/import-tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, tracks: pastePreview }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPasteText("");
      setPastePreview([]);
      setActiveModal(null);
      router.refresh();
    } catch (err) {
      console.error("[GameDetail] importPastedTracks failed:", err);
      setMutError("Failed to import tracks. Please try again.");
    }
  }

  async function markTracksReady() {
    setMutError(null);
    try {
      const res = await fetch(`/api/backstage/games/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarding_phase: "tracks_loaded" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      console.error("[GameDetail] markTracksReady failed:", err);
      setMutError("Failed to update phase. Please try again.");
    }
  }

  async function handleTrackSave(gameId: string, name: string, updates: PatchUpdates) {
    setMutError(null);
    try {
      const { videoId, durationSeconds, viewCount, ...trackUpdates } = updates;
      const body: Record<string, unknown> = { gameId, name, updates: trackUpdates };
      if (videoId) {
        body.videoUpdates = { videoId, durationSeconds, viewCount };
      }
      const res = await fetch("/api/backstage/tracks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      console.error("[GameDetail] handleTrackSave failed:", err);
      setMutError("Failed to save track. Please try again.");
    }
  }

  async function togglePublished() {
    setPublishing(true);
    setMutError(null);
    try {
      const res = await fetch("/api/backstage/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, published: !game.published }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      console.error("[GameDetail] togglePublished failed:", err);
      setMutError("Failed to update published status.");
    } finally {
      setPublishing(false);
    }
  }

  async function saveField(field: string, value: string | null) {
    setMutError(null);
    let payload: unknown = value === "" ? null : value;
    if (field === "steam_appid") {
      payload = value ? Number(value) : null;
    }
    try {
      const res = await fetch(`/api/backstage/games/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: payload }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      console.error(`[GameDetail] saveField(${field}) failed:`, err);
      setMutError(`Failed to update ${field}.`);
    }
  }

  async function toggleTrackActive(track: Track) {
    try {
      await fetch("/api/backstage/tracks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: game.id,
          name: track.name,
          updates: { active: !track.active },
        }),
      });
      router.refresh();
    } catch (err) {
      console.error("[GameDetail] toggleTrackActive failed:", err);
      setMutError("Failed to toggle track.");
    }
  }

  async function reviewDiscovered(approve: string[], reject: string[]) {
    setMutError(null);
    try {
      const res = await fetch("/api/backstage/tracks/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, approve, reject }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      console.error("[GameDetail] reviewDiscovered failed:", err);
      setMutError("Failed to review tracks.");
    }
  }

  async function deleteTrack(track: Track) {
    try {
      await fetch("/api/backstage/tracks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, names: [track.name] }),
      });
      router.refresh();
    } catch (err) {
      console.error("[GameDetail] deleteTrack failed:", err);
      setMutError("Failed to delete track.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Game header */}
      <div className="flex items-start gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-4">
        <div className="flex min-w-0 flex-1 gap-4">
          {thumbnailSrc && (
            <Image
              src={thumbnailSrc}
              alt={game.title}
              width={184}
              height={69}
              loading="eager"
              unoptimized
              className="shrink-0 rounded-md object-cover"
              style={{ width: 184, height: "auto" }}
            />
          )}
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <EditableTitle
                value={game.title}
                disabled={game.published}
                onSave={(v) => saveField("title", v)}
              />
              <StatusBadge phase={phase} />
            </div>

            <PhaseStepper currentPhase={phase} published={game.published} />

            <div className="flex flex-wrap gap-4 font-mono text-[11px] text-zinc-500">
              <span>{trackCount} tracks</span>
              <span>{activeCount} active</span>
              <span>{taggedCount} tagged</span>
              {reviewFlags.length > 0 && (
                <span className="text-amber-400">{reviewFlags.length} review flags</span>
              )}
            </div>
          </div>
        </div>

        {/* Controls — stacked on the right */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {/* Action bar */}
          <div className="flex items-center gap-2">
            <PrimaryAction
              phase={phase}
              trackCount={tracks.length}
              reviewFlagCount={reviewFlags.length}
              onMarkReady={markTracksReady}
              onRetry={() => setActiveModal("load-tracks")}
              onTag={() => setActiveModal("retag")}
              onResolve={() => setActiveModal("resolve")}
              onReviewFlags={() => flagsRef.current?.scrollIntoView({ behavior: "smooth" })}
            />

            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-zinc-700 text-xs text-zinc-300 hover:text-zinc-100"
                disabled={game.published}
                onClick={() => setPipelineOpen((o) => !o)}
                onBlur={() => setTimeout(() => setPipelineOpen(false), 150)}
              >
                Run Pipeline ▾
              </Button>
              {pipelineOpen && (
                <div className="absolute right-0 z-10 mt-1 w-48 rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-lg">
                  <DropdownItem
                    onClick={() => {
                      setPipelineOpen(false);
                      setActiveModal("quick-onboard");
                    }}
                  >
                    Run Full Pipeline
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => {
                      setPipelineOpen(false);
                      setActiveModal("load-tracks");
                    }}
                  >
                    Fetch from Discogs
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => {
                      setPipelineOpen(false);
                      setActiveModal("import-tracks");
                    }}
                  >
                    Paste Tracks
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => {
                      setPipelineOpen(false);
                      setActiveModal("retag");
                    }}
                  >
                    Force Re-Tag
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => {
                      setPipelineOpen(false);
                      setActiveModal("resolve");
                    }}
                  >
                    Force Re-Resolve
                  </DropdownItem>
                </div>
              )}
            </div>

            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 border-zinc-700 p-0 text-xs text-zinc-500 hover:text-zinc-300"
                disabled={game.published}
                onClick={() => setDangerOpen((o) => !o)}
                onBlur={() => setTimeout(() => setDangerOpen(false), 150)}
              >
                ⋯
              </Button>
              {dangerOpen && (
                <div className="absolute right-0 z-10 mt-1 w-52 rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-lg">
                  <DropdownItem
                    destructive
                    onClick={() => {
                      setDangerOpen(false);
                      setActiveModal("reingest");
                    }}
                  >
                    Reset Pipeline (Re-Sync Source)
                  </DropdownItem>
                  <DropdownItem
                    destructive
                    onClick={() => {
                      setDangerOpen(false);
                      setNukeOpen(true);
                    }}
                  >
                    Delete Game
                  </DropdownItem>
                </div>
              )}
            </div>
          </div>

          {/* Publish button */}
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  className={`group w-[110px] shrink-0 rounded-lg py-1.5 text-center text-xs font-semibold transition-all ${
                    game.published
                      ? "border border-emerald-600/40 bg-emerald-500/10 text-emerald-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400"
                      : phase === OnboardingPhase.Tagged
                        ? "bg-emerald-600 text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700"
                        : "cursor-not-allowed border border-zinc-700 text-zinc-600"
                  }`}
                  disabled={publishing || phase !== OnboardingPhase.Tagged}
                  onClick={togglePublished}
                >
                  {game.published ? (
                    <>
                      <span className="group-hover:hidden">● Published</span>
                      <span className="hidden group-hover:inline">Unpublish</span>
                    </>
                  ) : (
                    "Publish"
                  )}
                </button>
              }
            />
            {phase !== OnboardingPhase.Tagged && !game.published && (
              <TooltipContent>Complete all pipeline phases before publishing</TooltipContent>
            )}
          </Tooltip>
        </div>
      </div>

      {mutError && (
        <p className="rounded-lg border border-rose-800/30 bg-rose-900/10 px-4 py-2 text-xs text-rose-400">
          {mutError}
        </p>
      )}

      {/* Metadata editor — locked when published */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3">
        <div className="mb-3 flex items-center gap-2">
          <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
            Metadata
          </p>
          {game.published && <span className="text-[10px] text-zinc-600">Unpublish to edit</span>}
        </div>
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
          <TracklistSourceField
            value={game.tracklist_source}
            disabled={game.published}
            onSave={(v) => saveField("tracklist_source", v)}
          />
          <MetadataField
            label="YouTube Playlist"
            value={game.yt_playlist_id ?? ""}
            placeholder="e.g. PLxxxxxx"
            disabled={game.published}
            href={
              game.yt_playlist_id
                ? `https://www.youtube.com/playlist?list=${game.yt_playlist_id}`
                : undefined
            }
            onSave={(v) => saveField("yt_playlist_id", v)}
          />
          <MetadataField
            label="Thumbnail URL"
            value={game.thumbnail_url ?? ""}
            placeholder="https://..."
            disabled={game.published}
            href={game.thumbnail_url ?? undefined}
            onSave={(v) => saveField("thumbnail_url", v)}
          />
          <MetadataField
            label="Steam App ID"
            value={game.steam_appid?.toString() ?? ""}
            placeholder="e.g. 292030"
            disabled={game.published}
            href={
              game.steam_appid
                ? `https://store.steampowered.com/app/${game.steam_appid}`
                : undefined
            }
            onSave={(v) => saveField("steam_appid", v)}
          />
        </div>
      </div>

      {/* Review flags (collapsible) */}
      {reviewFlags.length > 0 && (
        <details
          ref={flagsRef}
          className="group rounded-lg border border-amber-800/30 bg-amber-900/10 px-4 py-3"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between">
            <p className="text-[11px] font-semibold tracking-wider text-amber-500 uppercase">
              <span className="mr-1 inline-block transition-transform group-open:rotate-90">▸</span>
              Review flags ({reviewFlags.length})
            </p>
            <button
              onClick={async (e) => {
                e.preventDefault();
                await fetch("/api/backstage/review-flags", {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ gameId: game.id }),
                });
                router.refresh();
              }}
              className="text-[10px] text-zinc-500 transition-colors hover:text-zinc-300"
            >
              Clear all
            </button>
          </summary>
          <div className="mt-2 space-y-1">
            {reviewFlags.map((flag) => (
              <div key={flag.id} className="flex items-center gap-2 font-mono text-[11px]">
                <Badge
                  variant="outline"
                  className="border-amber-700/50 bg-amber-500/10 text-amber-400"
                >
                  {flag.reason}
                </Badge>
                {flag.detail && <span className="text-zinc-500">{flag.detail}</span>}
                <span className="ml-auto text-zinc-600">{flag.createdAt.slice(0, 10)}</span>
                <button
                  onClick={async () => {
                    await fetch("/api/backstage/review-flags", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ flagId: flag.id, gameId: game.id }),
                    });
                    router.refresh();
                  }}
                  className="text-zinc-600 transition-colors hover:text-zinc-300"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Zero-state ingestion cards — shown in Draft with no tracks */}
      {tracks.length === 0 && phase === OnboardingPhase.Draft && (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setActiveModal("load-tracks")}
            className="group rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 px-6 py-8 text-left transition-colors hover:border-violet-600/50 hover:bg-violet-500/5"
          >
            <p className="text-sm font-medium text-zinc-200 group-hover:text-violet-300">
              Fetch from Discogs
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Auto-discover the tracklist by searching Discogs, or fetch a specific release/master
              ID from the tracklist source above.
            </p>
          </button>
          <button
            onClick={() => setActiveModal("import-tracks")}
            className="group rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 px-6 py-8 text-left transition-colors hover:border-violet-600/50 hover:bg-violet-500/5"
          >
            <p className="text-sm font-medium text-zinc-200 group-hover:text-violet-300">
              Paste Tracks
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Paste a tracklist from VGMdb, Wikipedia, or any source. One track per line — durations
              are detected automatically.
            </p>
          </button>
        </div>
      )}

      {/* Track list */}
      {(tracks.length > 0 || editingTracks) && (
        <div
          className={`overflow-hidden rounded-lg border ${editingTracks ? "border-violet-600/40" : "border-zinc-800"}`}
        >
          {/* Track header bar */}
          <div
            className={`flex items-center justify-between px-4 py-2 ${editingTracks ? "bg-violet-500/5" : "bg-zinc-900/40"}`}
          >
            <span className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
              Tracks ({tracks.length})
            </span>
            <div className="flex items-center gap-2">
              {tracks.some((t) => t.discovered === DiscoveredStatus.Pending) && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 border-emerald-600/40 px-2 text-[10px] text-emerald-400 hover:bg-emerald-500/10"
                    onClick={() =>
                      reviewDiscovered(
                        tracks
                          .filter((t) => t.discovered === DiscoveredStatus.Pending)
                          .map((t) => t.name),
                        [],
                      )
                    }
                  >
                    Approve All (
                    {tracks.filter((t) => t.discovered === DiscoveredStatus.Pending).length})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 border-rose-600/40 px-2 text-[10px] text-rose-400 hover:bg-rose-500/10"
                    onClick={() =>
                      reviewDiscovered(
                        [],
                        tracks
                          .filter((t) => t.discovered === DiscoveredStatus.Pending)
                          .map((t) => t.name),
                      )
                    }
                  >
                    Reject All
                  </Button>
                </>
              )}
              {editingTracks && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 border-zinc-700 px-2 text-[10px] text-zinc-300 hover:text-zinc-100"
                  onClick={() => setActiveModal("add-track")}
                >
                  + Add
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className={`h-6 px-2 text-[10px] ${editingTracks ? "border-violet-600/50 text-violet-400" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}
                onClick={() => setEditingTracks((v) => !v)}
              >
                {editingTracks ? "Done" : "Edit"}
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                {editingTracks && (
                  <TableHead className="w-8 text-[11px] tracking-wider text-zinc-500 uppercase" />
                )}
                <TableHead className="w-10 text-[11px] tracking-wider text-zinc-500 uppercase">
                  #
                </TableHead>
                <TableHead className="w-8 text-[11px] tracking-wider text-zinc-500 uppercase">
                  On
                </TableHead>
                <TableHead className="text-[11px] tracking-wider text-zinc-500 uppercase">
                  Name
                </TableHead>
                <TableHead className="w-16 text-[11px] tracking-wider text-zinc-500 uppercase">
                  Energy
                </TableHead>
                <TableHead className="text-[11px] tracking-wider text-zinc-500 uppercase">
                  Role
                </TableHead>
                <TableHead className="text-[11px] tracking-wider text-zinc-500 uppercase">
                  Moods
                </TableHead>
                <TableHead className="w-14 text-[11px] tracking-wider text-zinc-500 uppercase">
                  Vocals
                </TableHead>
                <TableHead className="w-8 text-[11px] tracking-wider text-zinc-500 uppercase" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tracks.map((track, i) => {
                const vid = videoMap[track.name];
                return (
                  <TableRow
                    key={track.name}
                    onClick={() => !editingTracks && setEditTrack(track)}
                    className={`border-zinc-800/60 hover:bg-zinc-800/30 ${editingTracks ? "" : "cursor-pointer"}`}
                  >
                    {editingTracks && (
                      <TableCell className="py-2 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDeleteTrack(track);
                          }}
                          className="text-zinc-600 transition-colors hover:text-rose-400"
                        >
                          ✕
                        </button>
                      </TableCell>
                    )}
                    <TableCell className="py-2 font-mono text-[11px] text-zinc-500">
                      {i + 1}
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      {editingTracks ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTrackActive(track);
                          }}
                          className={`transition-colors ${track.active ? "text-emerald-400 hover:text-zinc-600" : "text-zinc-600 hover:text-emerald-400"}`}
                        >
                          {track.active ? "●" : "○"}
                        </button>
                      ) : (
                        <span className={track.active ? "text-emerald-400" : "text-zinc-600"}>
                          {track.active ? "●" : "○"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            track.discovered === DiscoveredStatus.Rejected
                              ? "text-zinc-600 line-through"
                              : "text-zinc-200"
                          }
                        >
                          {track.name}
                        </span>
                        {track.discovered === DiscoveredStatus.Pending && (
                          <>
                            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400">
                              discovered
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                reviewDiscovered([track.name], []);
                              }}
                              className="rounded px-1.5 py-0.5 text-[10px] text-emerald-500 transition-colors hover:bg-emerald-500/10"
                            >
                              approve
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                reviewDiscovered([], [track.name]);
                              }}
                              className="rounded px-1.5 py-0.5 text-[10px] text-rose-500 transition-colors hover:bg-rose-500/10"
                            >
                              reject
                            </button>
                          </>
                        )}
                        {track.discovered === DiscoveredStatus.Rejected && (
                          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-600">
                            rejected
                          </span>
                        )}
                        {track.discovered === DiscoveredStatus.Approved && !track.taggedAt && (
                          <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-400">
                            approved
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <EnergyBadge energy={track.energy} />
                    </TableCell>
                    <TableCell className="py-2">
                      <TagBadgeList tags={track.roles} maxVisible={2} />
                    </TableCell>
                    <TableCell className="py-2">
                      <TagBadgeList tags={track.moods} maxVisible={2} />
                    </TableCell>
                    <TableCell className="py-2 text-center font-mono text-[11px] text-zinc-500">
                      {track.hasVocals === null ? "—" : track.hasVocals ? "yes" : "no"}
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      {vid && (
                        <a
                          href={`https://www.youtube.com/watch?v=${vid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-zinc-600 transition-colors hover:text-zinc-300"
                        >
                          ▶
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete track confirmation */}
      <Dialog open={!!pendingDeleteTrack} onOpenChange={(v) => !v && setPendingDeleteTrack(null)}>
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Delete track</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to delete{" "}
              <span className="font-mono text-zinc-200">{pendingDeleteTrack?.name}</span>? This will
              also remove its video mapping.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-zinc-400"
              onClick={() => setPendingDeleteTrack(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (pendingDeleteTrack) await deleteTrack(pendingDeleteTrack);
                setPendingDeleteTrack(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Tracks modal */}
      <Dialog
        open={activeModal === "load-tracks"}
        onOpenChange={(v) => !v && !sseRunning && setActiveModal(null)}
      >
        <DialogContent className="border-zinc-800 bg-zinc-900" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Load Tracks: {game.title}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Fetch tracklist from Discogs and store in database. Does not tag.
            </DialogDescription>
          </DialogHeader>
          <SSEProgress
            url="/api/backstage/load-tracks"
            body={{ gameId: game.id }}
            progressLabel={(e) => String(e.message ?? "Working…")}
            doneLabel={(e) => `Done — ${e.trackCount} tracks loaded`}
            onDone={() => router.refresh()}
            onClose={() => {
              setSseRunning(false);
              setActiveModal(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Resolve Videos modal */}
      <Dialog
        open={activeModal === "resolve"}
        onOpenChange={(v) => !v && !sseRunning && setActiveModal(null)}
      >
        <DialogContent className="border-zinc-800 bg-zinc-900" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Resolve Videos: {game.title}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Discover YouTube OST playlist and map tracks to video IDs.
            </DialogDescription>
          </DialogHeader>
          <SSEProgress
            url="/api/backstage/resolve"
            body={{ gameId: game.id }}
            progressLabel={(e) => String(e.message ?? "Resolving…")}
            doneLabel={(e) => `Done — ${e.resolved}/${e.total} tracks resolved`}
            onDone={() => router.refresh()}
            onClose={() => {
              setSseRunning(false);
              setActiveModal(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Quick Onboard modal */}
      <Dialog
        open={activeModal === "quick-onboard"}
        onOpenChange={(v) => !v && !sseRunning && setActiveModal(null)}
      >
        <DialogContent className="border-zinc-800 bg-zinc-900" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Quick Onboard: {game.title}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Run all phases (load tracks, resolve, tag) and publish.
            </DialogDescription>
          </DialogHeader>
          <SSEProgress
            url="/api/backstage/quick-onboard"
            body={{ gameId: game.id }}
            progressLabel={(e) => String(e.message ?? "Working…")}
            doneLabel={(e) =>
              `Done — ${e.trackCount} tracks, ${e.resolved} resolved, ${e.tagged} tagged`
            }
            onDone={() => router.refresh()}
            onClose={() => {
              setSseRunning(false);
              setActiveModal(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Re-tag modal */}
      <Dialog
        open={activeModal === "retag"}
        onOpenChange={(v) => !v && !sseRunning && setActiveModal(null)}
      >
        <DialogContent className="border-zinc-800 bg-zinc-900" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Re-tag: {game.title}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Clears all LLM tags and re-runs the tagger. Track names are preserved.
            </DialogDescription>
          </DialogHeader>
          <SSEProgress
            url="/api/backstage/retag"
            body={{ gameId: game.id }}
            progressLabel={(e) =>
              `Tagging track ${e.current ?? 0}/${e.total ?? "?"}… ${e.trackName ?? ""}`
            }
            doneLabel={(e) => `Done — ${e.tagged} tagged, ${e.needsReview} need review`}
            onDone={() => router.refresh()}
            onClose={() => {
              setSseRunning(false);
              setActiveModal(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Re-ingest dialog */}
      <Dialog
        open={activeModal === "reingest"}
        onOpenChange={(v) => !v && !reingestRunning && closeReingest()}
      >
        <DialogContent className="border-zinc-800 bg-zinc-900" showCloseButton={!reingestRunning}>
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Re-ingest: {game.title}</DialogTitle>
            {!reingestRunning && (
              <DialogDescription className="text-zinc-400">
                This will delete all {trackCount} tracks and re-fetch from Discogs. This cannot be
                undone.
              </DialogDescription>
            )}
          </DialogHeader>
          {reingestRunning ? (
            <SSEProgress
              url="/api/backstage/reingest"
              body={{ gameId: game.id }}
              progressLabel={(e) => String(e.message ?? "Working…")}
              doneLabel={(e) =>
                `Done — ${e.trackCount} tracks, ${e.resolved} resolved, ${e.tagged} tagged`
              }
              onDone={() => router.refresh()}
              onClose={closeReingest}
            />
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">
                Type <span className="font-mono text-zinc-200">{game.title}</span> to confirm
              </p>
              <Input
                value={reingestTyped}
                onChange={(e) => setReingestTyped(e.target.value)}
                placeholder={game.title}
                className="border-zinc-700 bg-zinc-800 font-mono text-zinc-100 placeholder:text-zinc-600"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && reingestTyped === game.title) setReingestRunning(true);
                }}
              />
              <DialogFooter>
                <Button variant="ghost" className="text-zinc-400" onClick={closeReingest}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={reingestTyped !== game.title}
                  onClick={() => setReingestRunning(true)}
                >
                  Re-ingest
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add track modal */}
      <Dialog open={activeModal === "add-track"} onOpenChange={(v) => !v && setActiveModal(null)}>
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Add track</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Manually add a track to {game.title}. It will be untagged until the next re-tag.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Track name…"
              value={newTrackName}
              onChange={(e) => setNewTrackName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTrack()}
              className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-600"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-400"
                onClick={() => setActiveModal(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-violet-600 text-white hover:bg-violet-700"
                onClick={addTrack}
                disabled={!newTrackName.trim()}
              >
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Paste/import tracks modal */}
      <Dialog
        open={activeModal === "import-tracks"}
        onOpenChange={(v) => {
          if (!v) {
            setActiveModal(null);
            setPasteText("");
            setPastePreview([]);
          }
        }}
      >
        <DialogContent className="border-zinc-800 bg-zinc-900 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Paste Tracks</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Paste a tracklist — one track per line. Durations (M:SS) are detected automatically.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={pasteText}
            onChange={(e) => handlePasteChange(e.target.value)}
            placeholder={
              "01. A Premonition 0:35\n02. Chrono Trigger 2:27\n03. Morning Sunlight 2:45"
            }
            rows={10}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          />
          {pastePreview.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-800/50 px-3 py-2">
              <p className="mb-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                Preview ({pastePreview.length} tracks)
              </p>
              {pastePreview.map((t) => (
                <div key={t.position} className="flex items-center gap-2 py-0.5 text-xs">
                  <span className="w-6 text-right text-zinc-600">{t.position}.</span>
                  <span className="flex-1 text-zinc-300">{t.name}</span>
                  {t.durationSeconds !== null && (
                    <span className="text-zinc-500">
                      {Math.floor(t.durationSeconds / 60)}:
                      {String(t.durationSeconds % 60).padStart(2, "0")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400"
              onClick={() => {
                setActiveModal(null);
                setPasteText("");
                setPastePreview([]);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-violet-600 text-white hover:bg-violet-700"
              onClick={importPastedTracks}
              disabled={pastePreview.length === 0}
            >
              Import {pastePreview.length} Tracks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Track edit sheet */}
      {editTrack && (
        <TrackEditSheet
          key={editTrack.name}
          track={editTrack}
          videoMeta={videoDetailMap[editTrack.name] ?? null}
          open={!!editTrack}
          onOpenChange={(open) => {
            if (!open) setEditTrack(null);
          }}
          onSave={handleTrackSave}
        />
      )}

      {/* Nuke game confirmation */}
      <ConfirmModal
        open={nukeOpen}
        onOpenChange={setNukeOpen}
        title={`Delete ${game.title}?`}
        description="This will permanently delete this game and all its tracks, video mappings, review flags, and playlist references. It will also be removed from all user libraries. This cannot be undone."
        confirmLabel={nuking ? "Deleting…" : "Delete"}
        typeToConfirm={game.title}
        destructive
        onConfirm={async () => {
          setNuking(true);
          try {
            const res = await fetch(`/api/backstage/games/${game.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            router.push("/backstage/games");
          } catch (err) {
            console.error("[GameDetail] nuke failed:", err);
            setMutError("Failed to delete game. Please try again.");
            setNuking(false);
          }
        }}
      />
    </div>
  );
}

// ─── Editable title ──────────────────────────────────────────────────────────

function EditableTitle({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled?: boolean;
  onSave: (value: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setDraft(value);
  }

  if (editing && !disabled) {
    return (
      <Input
        autoFocus
        maxLength={100}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="h-8 border-zinc-700 bg-zinc-800 font-sans text-xl font-semibold text-zinc-100"
      />
    );
  }

  return (
    <h1
      onClick={() => {
        if (!disabled) {
          setDraft(value);
          setEditing(true);
        }
      }}
      className={`font-sans text-xl font-semibold text-zinc-100 ${
        disabled ? "" : "-ml-1 cursor-pointer rounded px-1 hover:bg-zinc-800/60"
      }`}
    >
      {value}
    </h1>
  );
}

// ─── Tracklist Source field (dropdown + ID) ─────────────────────────────────

function TracklistSourceField({
  value,
  disabled,
  onSave,
}: {
  value: string | null;
  disabled?: boolean;
  onSave: (value: string | null) => void;
}) {
  const sources = getRegisteredSources();
  const parsed = parseSource(value);
  const [sourceKey, setSourceKey] = useState(parsed?.key ?? "");
  const [sourceId, setSourceId] = useState(parsed?.id ?? "");

  const href = sourceUrl(sourceKey && sourceId ? formatSource(sourceKey, sourceId) : null);
  const isDirty = sourceKey !== (parsed?.key ?? "") || sourceId !== (parsed?.id ?? "");

  function save() {
    if (!isDirty) return;
    onSave(sourceKey && sourceId ? formatSource(sourceKey, sourceId) : null);
  }

  return (
    <>
      <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-500">
        Tracklist Source
        {href && sourceId && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-600 transition-colors hover:text-zinc-300"
          >
            ↗
          </a>
        )}
      </span>
      <div className="flex items-center gap-2">
        <Select
          value={sourceKey}
          onValueChange={(v) => {
            const next = v || "";
            setSourceKey(next);
            if (!next) {
              setSourceId("");
              onSave(null);
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger className="h-7 w-auto min-w-[130px] border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-300">
            <span className="flex flex-1 text-left">
              {sources.find((s) => s.key === sourceKey)?.label ?? "Auto-discover"}
            </span>
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900">
            <SelectItem value="" className="text-xs text-zinc-400">
              Auto-discover
            </SelectItem>
            {sources.map((s) => (
              <SelectItem key={s.key} value={s.key} className="text-xs text-zinc-300">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {sourceKey && (
          <Input
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value.replace(/\D/g, ""))}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            placeholder="ID"
            disabled={disabled}
            className="h-7 w-24 border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-300"
          />
        )}
        {isDirty && sourceKey && sourceId && (
          <button onClick={save} className="text-[10px] text-emerald-500 hover:text-emerald-400">
            Save
          </button>
        )}
      </div>
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── Inline metadata field ───────────────────────────────────────────────────

function MetadataField({
  label,
  value,
  placeholder,
  disabled,
  href,
  onSave,
}: {
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  href?: string;
  onSave: (value: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    setEditing(false);
    if (draft !== value) onSave(draft || null);
  }

  return (
    <>
      <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-500">
        {label}
        {href && value && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-600 transition-colors hover:text-zinc-300"
            onClick={(e) => e.stopPropagation()}
          >
            ↗
          </a>
        )}
      </span>
      {editing && !disabled ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          placeholder={placeholder}
          className="h-7 border-zinc-700 bg-zinc-800 font-mono text-xs text-zinc-100 placeholder:text-zinc-600"
        />
      ) : (
        <button
          onClick={() => {
            if (disabled) return;
            setDraft(value);
            setEditing(true);
          }}
          className={`truncate rounded px-1.5 py-1 text-left font-mono text-xs transition-colors ${
            disabled ? "cursor-default text-zinc-600" : "text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          {value || <span className="text-zinc-600">{disabled ? "—" : placeholder}</span>}
        </button>
      )}
    </>
  );
}

// ─── Zone A: Primary action button ───────────────────────────────────────────

function PrimaryAction({
  phase,
  trackCount,
  reviewFlagCount,
  onMarkReady,
  onRetry,
  onTag,
  onResolve,
  onReviewFlags,
}: {
  phase: OnboardingPhase;
  trackCount: number;
  reviewFlagCount: number;
  onMarkReady: () => void;
  onRetry: () => void;
  onTag: () => void;
  onResolve: () => void;
  onReviewFlags: () => void;
}) {
  const hasFlags = reviewFlagCount > 0;

  // Any phase with flags → review flags first
  if (hasFlags && phase !== OnboardingPhase.Tagged) {
    return (
      <Button
        size="sm"
        className="h-7 bg-amber-600 text-xs text-white hover:bg-amber-700"
        onClick={onReviewFlags}
      >
        Review Flags ({reviewFlagCount})
      </Button>
    );
  }

  switch (phase) {
    case OnboardingPhase.Draft:
      if (trackCount > 0) {
        return (
          <Button
            size="sm"
            className="h-7 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
            onClick={onMarkReady}
          >
            Mark Tracks Ready
          </Button>
        );
      }
      // No tracks — zero-state cards in the body handle this
      return null;
    case OnboardingPhase.TracksLoaded:
      return (
        <Button
          size="sm"
          className="h-7 bg-violet-600 text-xs text-white hover:bg-violet-700"
          onClick={onResolve}
        >
          Resolve Videos
        </Button>
      );
    case OnboardingPhase.Resolved:
      return (
        <Button
          size="sm"
          className="h-7 bg-violet-600 text-xs text-white hover:bg-violet-700"
          onClick={onTag}
        >
          Run LLM Tagging
        </Button>
      );
    case OnboardingPhase.Tagged:
      return (
        <Button
          size="sm"
          variant="outline"
          className="pointer-events-none h-7 border-emerald-700/40 text-xs text-emerald-400"
          disabled
        >
          Pipeline complete
        </Button>
      );
    case OnboardingPhase.Failed:
      return (
        <Button
          size="sm"
          className="h-7 bg-violet-600 text-xs text-white hover:bg-violet-700"
          onClick={onRetry}
        >
          Retry: Fetch Tracklist
        </Button>
      );
  }
}

// ─── Dropdown item ───────────────────────────────────────────────────────────

function DropdownItem({
  children,
  onClick,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`block w-full px-3 py-1.5 text-left text-xs transition-colors ${
        destructive ? "text-rose-400 hover:bg-rose-500/10" : "text-zinc-300 hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}
