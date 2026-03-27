"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

enum GameStatus {
  Pending = "pending",
  InProgress = "in_progress",
  Done = "done",
  Error = "error",
}

interface GameEntry {
  gameId: string;
  title: string;
  status: GameStatus;
  message?: string;
}

interface BulkOnboardProgressProps {
  open: boolean;
  gameIds: string[];
  onClose: () => void;
}

export function BulkOnboardProgress({ open, gameIds, onClose }: BulkOnboardProgressProps) {
  const [entries, setEntries] = useState<GameEntry[]>([]);
  const [summary, setSummary] = useState<{ succeeded: number; failed: number } | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open || gameIds.length === 0) return;

    setEntries(gameIds.map((id) => ({ gameId: id, title: id, status: GameStatus.Pending })));
    setSummary(null);
    setRunning(true);

    const abort = new AbortController();
    abortRef.current = abort;

    (async () => {
      try {
        const res = await fetch("/api/backstage/bulk-onboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameIds }),
          signal: abort.signal,
        });

        if (!res.ok || !res.body) {
          setRunning(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const match = line.match(/^data: (.+)$/);
            if (!match) continue;

            try {
              const event = JSON.parse(match[1]);
              handleEvent(event);
            } catch {
              /* skip malformed */
            }
          }
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("[BulkOnboardProgress]", err);
        }
      } finally {
        setRunning(false);
      }
    })();

    return () => abort.abort();
  }, [open, gameIds]);

  function handleEvent(event: Record<string, unknown>) {
    const type = event.type as string;
    const gameId = event.gameId as string;

    switch (type) {
      case "game-start":
        setEntries((prev) =>
          prev.map((e) =>
            e.gameId === gameId
              ? { ...e, title: event.title as string, status: GameStatus.InProgress }
              : e,
          ),
        );
        break;
      case "game-progress":
        setEntries((prev) =>
          prev.map((e) => (e.gameId === gameId ? { ...e, message: event.message as string } : e)),
        );
        break;
      case "game-done":
        setEntries((prev) =>
          prev.map((e) =>
            e.gameId === gameId
              ? {
                  ...e,
                  status: GameStatus.Done,
                  message: `${event.trackCount} tracks, ${event.tagged} tagged, ${event.resolved} resolved`,
                }
              : e,
          ),
        );
        break;
      case "game-error":
        setEntries((prev) =>
          prev.map((e) =>
            e.gameId === gameId
              ? { ...e, status: GameStatus.Error, message: event.message as string }
              : e,
          ),
        );
        break;
      case "all-done":
        setSummary({
          succeeded: event.succeeded as number,
          failed: event.failed as number,
        });
        break;
    }
  }

  const statusIcon = (status: GameStatus) => {
    switch (status) {
      case GameStatus.Pending:
        return <span className="text-zinc-600">○</span>;
      case GameStatus.InProgress:
        return <span className="animate-pulse text-violet-400">◉</span>;
      case GameStatus.Done:
        return <span className="text-emerald-400">✓</span>;
      case GameStatus.Error:
        return <span className="text-rose-400">✗</span>;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !running) onClose();
      }}
    >
      <DialogContent className="max-h-[70vh] border-zinc-800 bg-zinc-900 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">
            Bulk Quick Onboard
            {running && <span className="ml-2 text-sm font-normal text-zinc-500">Processing…</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-80 space-y-1 overflow-y-auto">
          {entries.map((entry) => (
            <div key={entry.gameId} className="flex items-start gap-2 rounded px-2 py-1.5 text-xs">
              <span className="mt-0.5 w-4 shrink-0 text-center">{statusIcon(entry.status)}</span>
              <div className="min-w-0 flex-1">
                <span className="text-zinc-200">{entry.title}</span>
                {entry.message && (
                  <p
                    className={`mt-0.5 truncate ${entry.status === GameStatus.Error ? "text-rose-400/80" : "text-zinc-500"}`}
                  >
                    {entry.message}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {summary && (
          <div className="rounded border border-zinc-800 bg-zinc-800/50 px-3 py-2 text-xs">
            <span className="text-emerald-400">{summary.succeeded} succeeded</span>
            {summary.failed > 0 && (
              <span className="ml-3 text-rose-400">{summary.failed} failed</span>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={running}>
            {running ? "Running…" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
