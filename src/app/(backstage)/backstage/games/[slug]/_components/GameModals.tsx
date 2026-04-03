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
import { SSEProgress } from "@/components/backstage/SSEProgress";
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

  function handlePasteChange(text: string) {
    setPasteText(text);
    setPastePreview(text.trim() ? parseTracklist(text) : []);
  }

  function closeModal() {
    setActiveModal(null);
    actions.setSseRunning(false);
  }

  return (
    <>
      {/* Load Tracks modal */}
      <Dialog
        open={activeModal === BackstageModal.LoadTracks}
        onOpenChange={(v) => !v && !actions.sseRunning && setActiveModal(null)}
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
            onDone={() => closeModal()}
            onClose={closeModal}
          />
        </DialogContent>
      </Dialog>

      {/* Resolve Videos modal */}
      <Dialog
        open={activeModal === BackstageModal.Resolve}
        onOpenChange={(v) => !v && !actions.sseRunning && setActiveModal(null)}
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
            onDone={() => closeModal()}
            onClose={closeModal}
          />
        </DialogContent>
      </Dialog>

      {/* Quick Onboard modal */}
      <Dialog
        open={activeModal === BackstageModal.QuickOnboard}
        onOpenChange={(v) => !v && !actions.sseRunning && setActiveModal(null)}
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
            onDone={() => closeModal()}
            onClose={closeModal}
          />
        </DialogContent>
      </Dialog>

      {/* Re-tag modal */}
      <Dialog
        open={activeModal === BackstageModal.Retag}
        onOpenChange={(v) => !v && !actions.sseRunning && setActiveModal(null)}
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
            onDone={() => closeModal()}
            onClose={closeModal}
          />
        </DialogContent>
      </Dialog>

      {/* Re-ingest dialog */}
      <Dialog
        open={activeModal === BackstageModal.Reingest}
        onOpenChange={(v) =>
          !v &&
          !actions.reingestRunning &&
          (() => {
            actions.closeReingest();
            setActiveModal(null);
          })()
        }
      >
        <DialogContent
          className="border-zinc-800 bg-zinc-900"
          showCloseButton={!actions.reingestRunning}
        >
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Re-ingest: {game.title}</DialogTitle>
            {!actions.reingestRunning && (
              <DialogDescription className="text-zinc-400">
                This will delete all tracks and re-fetch from Discogs. This cannot be undone.
              </DialogDescription>
            )}
          </DialogHeader>
          {actions.reingestRunning ? (
            <SSEProgress
              url="/api/backstage/reingest"
              body={{ gameId: game.id }}
              progressLabel={(e) => String(e.message ?? "Working…")}
              doneLabel={(e) =>
                `Done — ${e.trackCount} tracks, ${e.resolved} resolved, ${e.tagged} tagged`
              }
              onDone={() => {
                actions.closeReingest();
                closeModal();
              }}
              onClose={() => {
                actions.closeReingest();
                closeModal();
              }}
            />
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">
                Type <span className="font-mono text-zinc-200">{game.title}</span> to confirm
              </p>
              <Input
                value={actions.reingestTyped}
                onChange={(e) => actions.setReingestTyped(e.target.value)}
                placeholder={game.title}
                className="border-zinc-700 bg-zinc-800 font-mono text-zinc-100 placeholder:text-zinc-600"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && actions.reingestTyped === game.title)
                    actions.setReingestRunning(true);
                }}
              />
              <DialogFooter>
                <Button
                  variant="ghost"
                  className="text-zinc-400"
                  onClick={() => {
                    actions.closeReingest();
                    setActiveModal(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={actions.reingestTyped !== game.title}
                  onClick={() => actions.setReingestRunning(true)}
                >
                  Re-ingest
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
