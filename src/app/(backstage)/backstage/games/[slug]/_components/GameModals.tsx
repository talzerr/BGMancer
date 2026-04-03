"use client";

import { useState } from "react";
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
import { parseTracklist, type ParsedTrack } from "@/lib/services/track-parser";
import { BackstageModal } from "@/types";
import type { Game } from "@/types";
import type { GameDetailActions } from "../_hooks/useGameDetailActions";
import type { ActiveModal } from "../game-detail-client";

export function GameModals({
  game,
  activeModal,
  setActiveModal,
  actions,
}: {
  game: Game;
  activeModal: ActiveModal;
  setActiveModal: (modal: ActiveModal) => void;
  actions: GameDetailActions;
}) {
  // Form state local to modals — resets when modal closes
  const [newTrackName, setNewTrackName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pastePreview, setPastePreview] = useState<ParsedTrack[]>([]);
  const [reingestRunning, setReingestRunning] = useState(false);

  function handlePasteChange(text: string) {
    setPasteText(text);
    setPastePreview(text.trim() ? parseTracklist(text) : []);
  }

  function closeModal() {
    setActiveModal(null);
    actions.setSseRunning(false);
  }

  function closeReingest() {
    setReingestRunning(false);
    setActiveModal(null);
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
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  await actions.addTrack(newTrackName);
                  setNewTrackName("");
                  setActiveModal(null);
                }
              }}
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
              onClick={async () => {
                await actions.importPastedTracks(pastePreview);
                setPasteText("");
                setPastePreview([]);
                setActiveModal(null);
              }}
              disabled={pastePreview.length === 0}
            >
              Import {pastePreview.length} Tracks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
