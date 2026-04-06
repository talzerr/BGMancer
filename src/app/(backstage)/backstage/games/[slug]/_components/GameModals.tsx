"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SSEDialog } from "@/components/backstage/SSEDialog";
import { ConfirmModal } from "@/components/backstage/ConfirmModal";
import { parseTracklist, type ParsedTrack } from "@/lib/services/parsing/track-parser";
import { BackstageModal, DiscoveredStatus } from "@/types";
import type { Game, Track } from "@/types";
import type { GameDetailActions } from "../_hooks/useGameDetailActions";
import type { ActiveModal } from "../GameDetailClient";

export function GameModals({
  game,
  activeModal,
  setActiveModal,
  actions,
  tracks,
  videoMap,
  selected,
  onSseDone,
}: {
  game: Game;
  activeModal: ActiveModal;
  setActiveModal: (modal: ActiveModal) => void;
  actions: GameDetailActions;
  tracks: Track[];
  videoMap: Record<string, string>;
  selected: Set<string>;
  onSseDone?: () => void;
}) {
  // Form state local to modals — resets when modal closes
  const [newTrackName, setNewTrackName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pastePreview, setPastePreview] = useState<ParsedTrack[]>([]);
  const [reingestRunning, setReingestRunning] = useState(false);

  // Derive track names for selective SSE modals:
  // If tracks are selected via checkboxes, use those. Otherwise fall back to all matching tracks.
  function getTrackNamesForModal(modal: ActiveModal): string[] {
    if (selected.size > 0) return [...selected];
    if (modal === BackstageModal.ResolveSelected) {
      return tracks
        .filter((t) => !videoMap[t.name] && t.discovered !== DiscoveredStatus.Rejected)
        .map((t) => t.name);
    }
    if (modal === BackstageModal.TagSelected) {
      return tracks
        .filter((t) => t.energy === null && t.discovered !== DiscoveredStatus.Rejected)
        .map((t) => t.name);
    }
    return [];
  }

  const selectedTrackNames = getTrackNamesForModal(activeModal);
  const router = useRouter();

  function handlePasteChange(text: string) {
    setPasteText(text);
    setPastePreview(text.trim() ? parseTracklist(text) : []);
  }

  function closeModal() {
    setActiveModal(null);
    actions.setSseRunning(false);
    onSseDone?.();
    router.refresh();
  }

  function closeReingest() {
    setReingestRunning(false);
    setActiveModal(null);
    router.refresh();
  }

  return (
    <>
      {/* Load Tracks */}
      <SSEDialog
        open={activeModal === BackstageModal.LoadTracks}
        onOpenChange={() => setActiveModal(null)}
        title={`Load Tracks: ${game.title}`}
        description="Fetch tracklist from Discogs and store in database. Does not tag."
        sseRunning={actions.sseRunning}
        url="/api/backstage/load-tracks"
        body={{ gameId: game.id }}
        progressLabel={(e) => String(e.message ?? "Working…")}
        doneLabel={(e) => `Done — ${e.trackCount} tracks loaded`}
        onDone={closeModal}
        onClose={closeModal}
      />

      {/* Resolve Videos */}
      <SSEDialog
        open={activeModal === BackstageModal.Resolve}
        onOpenChange={() => setActiveModal(null)}
        title={`Resolve Videos: ${game.title}`}
        description="Discover YouTube OST playlist and map tracks to video IDs."
        sseRunning={actions.sseRunning}
        url="/api/backstage/resolve"
        body={{ gameId: game.id }}
        progressLabel={(e) => String(e.message ?? "Resolving…")}
        doneLabel={(e) => `Done — ${e.resolved}/${e.total} tracks resolved`}
        onDone={closeModal}
        onClose={closeModal}
      />

      {/* Quick Onboard */}
      <SSEDialog
        open={activeModal === BackstageModal.QuickOnboard}
        onOpenChange={() => setActiveModal(null)}
        title={`Quick Onboard: ${game.title}`}
        description="Run all phases (load tracks, resolve, tag) and publish."
        sseRunning={actions.sseRunning}
        url="/api/backstage/quick-onboard"
        body={{ gameId: game.id }}
        progressLabel={(e) => String(e.message ?? "Working…")}
        doneLabel={(e) =>
          `Done — ${e.trackCount} tracks, ${e.resolved} resolved, ${e.tagged} tagged`
        }
        onDone={closeModal}
        onClose={closeModal}
      />

      {/* Re-tag */}
      <SSEDialog
        open={activeModal === BackstageModal.Retag}
        onOpenChange={() => setActiveModal(null)}
        title={`Re-tag: ${game.title}`}
        description="Clears all LLM tags and re-runs the tagger. Track names are preserved."
        sseRunning={actions.sseRunning}
        url="/api/backstage/retag"
        body={{ gameId: game.id }}
        progressLabel={(e) =>
          `Tagging track ${e.current ?? 0}/${e.total ?? "?"}… ${e.trackName ?? ""}`
        }
        doneLabel={(e) => `Done — ${e.tagged} tagged, ${e.needsReview} need review`}
        onDone={closeModal}
        onClose={closeModal}
      />

      {/* Re-ingest: confirm phase */}
      {!reingestRunning && (
        <ConfirmModal
          open={activeModal === BackstageModal.Reingest}
          onOpenChange={(v) => !v && setActiveModal(null)}
          title={`Re-ingest: ${game.title}`}
          description="This will delete all tracks and re-fetch from Discogs. This cannot be undone."
          confirmLabel="Re-ingest"
          typeToConfirm={game.title}
          destructive
          onConfirm={() => setReingestRunning(true)}
        />
      )}

      {/* Re-ingest: SSE phase */}
      <SSEDialog
        open={activeModal === BackstageModal.Reingest && reingestRunning}
        onOpenChange={() => closeReingest()}
        title={`Re-ingest: ${game.title}`}
        description="Re-ingesting tracks from source…"
        sseRunning={reingestRunning}
        url="/api/backstage/reingest"
        body={{ gameId: game.id }}
        progressLabel={(e) => String(e.message ?? "Working…")}
        doneLabel={(e) =>
          `Done — ${e.trackCount} tracks, ${e.resolved} resolved, ${e.tagged} tagged`
        }
        onDone={closeReingest}
        onClose={closeReingest}
      />

      {/* Resolve Selected / All Unresolved */}
      <SSEDialog
        open={activeModal === BackstageModal.ResolveSelected}
        onOpenChange={() => setActiveModal(null)}
        title={`Resolve: ${game.title}`}
        description={`Resolving ${selectedTrackNames.length} unresolved track${selectedTrackNames.length === 1 ? "" : "s"} to YouTube videos.`}
        sseRunning={actions.sseRunning}
        url="/api/backstage/resolve-selected"
        body={{ gameId: game.id, trackNames: selectedTrackNames }}
        progressLabel={(e) => String(e.message ?? "Resolving…")}
        doneLabel={(e) => `Done — ${e.resolved}/${e.total} tracks resolved`}
        onDone={closeModal}
        onClose={closeModal}
      />

      {/* Tag Selected / All Untagged */}
      <SSEDialog
        open={activeModal === BackstageModal.TagSelected}
        onOpenChange={() => setActiveModal(null)}
        title={`Tag: ${game.title}`}
        description={`Running LLM tagging on ${selectedTrackNames.length} untagged track${selectedTrackNames.length === 1 ? "" : "s"}. Existing tags are preserved.`}
        sseRunning={actions.sseRunning}
        url="/api/backstage/tag-selected"
        body={{ gameId: game.id, trackNames: selectedTrackNames }}
        progressLabel={(e) =>
          `Tagging track ${e.current ?? 0}/${e.total ?? "?"}… ${e.trackName ?? ""}`
        }
        doneLabel={(e) => `Done — ${e.tagged} tagged, ${e.needsReview} need review`}
        onDone={closeModal}
        onClose={closeModal}
      />

      {/* Add track modal */}
      <Dialog
        open={activeModal === BackstageModal.AddTrack}
        onOpenChange={(v) => {
          if (!v) {
            setActiveModal(null);
            setNewTrackName("");
          }
        }}
      >
        <DialogContent className="border-border bg-secondary">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add track</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Manually add a track to {game.title}. It will be untagged until the next re-tag.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Track name…"
              value={newTrackName}
              onChange={(e) => setNewTrackName(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  await actions.addTrack(newTrackName);
                  setNewTrackName("");
                  setActiveModal(null);
                }
              }}
              className="border-border bg-secondary text-foreground placeholder:text-[var(--text-disabled)]"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setActiveModal(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]"
                onClick={async () => {
                  await actions.addTrack(newTrackName);
                  setNewTrackName("");
                  setActiveModal(null);
                }}
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
        open={activeModal === BackstageModal.ImportTracks}
        onOpenChange={(v) => {
          if (!v) {
            setActiveModal(null);
            setPasteText("");
            setPastePreview([]);
          }
        }}
      >
        <DialogContent className="border-border bg-secondary sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Paste Tracks</DialogTitle>
            <DialogDescription className="text-muted-foreground">
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
            className="border-border bg-secondary text-foreground w-full rounded-md border px-3 py-2 font-mono text-xs placeholder:text-[var(--text-disabled)] focus:border-[var(--border-emphasis)] focus:outline-none"
          />
          {pastePreview.length > 0 && (
            <div className="border-border bg-secondary/50 max-h-48 overflow-y-auto rounded-md border px-3 py-2">
              <p className="mb-1 text-[10px] font-medium tracking-wider text-[var(--text-tertiary)] uppercase">
                Preview ({pastePreview.length} tracks)
              </p>
              {pastePreview.map((t) => (
                <div key={t.position} className="flex items-center gap-2 py-0.5 text-xs">
                  <span className="w-6 text-right text-[var(--text-disabled)]">{t.position}.</span>
                  <span className="text-foreground flex-1">{t.name}</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
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
              className="bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]"
              onClick={async () => {
                await actions.importPastedTracks(pastePreview);
                setPasteText("");
                setPastePreview([]);
                setActiveModal(null);
              }}
              disabled={pastePreview.length === 0 || actions.importing}
            >
              {actions.importing ? "Importing…" : `Import ${pastePreview.length} Tracks`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
