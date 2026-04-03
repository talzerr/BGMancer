"use client";

import { useEffect, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { SSEEventType } from "@/types";

type SSEEvent = Record<string, unknown>;

interface SSEProgressProps {
  url: string;
  body: Record<string, unknown>;
  onDone?: (event: SSEEvent) => void;
  onError?: (message: string) => void;
  onClose?: () => void;
  /** Progress label e.g. "Tagging track 5/20…" */
  progressLabel?: (event: SSEEvent) => string;
  /** Completion label */
  doneLabel?: (event: SSEEvent) => string;
  /** Called when the dialog wants to prevent closing (return false to block) */
  onPreventClose?: () => void;
}

export function SSEProgress({
  url,
  body,
  onDone,
  onError,
  onClose,
  progressLabel,
  doneLabel,
}: SSEProgressProps) {
  const [message, setMessage] = useState("Starting…");
  const [progress, setProgress] = useState(5);
  const [done, setDone] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    abortRef.current = abort;

    (async () => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abort.signal,
        });

        if (!res.body) {
          onError?.("No response body");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { value, done: streamDone } = await reader.read();
          if (streamDone) break;

          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            let eventData: SSEEvent;
            try {
              eventData = JSON.parse(line.slice(5).trim()) as SSEEvent;
            } catch {
              console.error("[SSEProgress] Failed to parse SSE line:", line);
              continue;
            }

            if (eventData.type === SSEEventType.Progress) {
              const label = progressLabel
                ? progressLabel(eventData)
                : String(eventData.message ?? "Working…");
              setMessage(label);
              const current = Number(eventData.current ?? 0);
              const total = Number(eventData.total ?? 0);
              if (total > 0) setProgress(Math.round((current / total) * 90) + 5);
            } else if (eventData.type === SSEEventType.Done) {
              setProgress(100);
              setMessage(doneLabel ? doneLabel(eventData) : "Done");
              setDone(true);
              onDone?.(eventData);
            } else if (eventData.type === SSEEventType.Error) {
              const msg = String(eventData.message ?? "Unknown error");
              setMessage(msg === "Cancelled" ? "Cancelled" : `Error: ${msg}`);
              onError?.(msg);
              setDone(true);
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setMessage("Cancelled");
          setDone(true);
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        setMessage(`Error: ${msg}`);
        onError?.(msg);
        setDone(true);
      }
    })();

    return () => abort.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleCancel() {
    setCancelled(true);
    abortRef.current?.abort();
  }

  return (
    <div className="space-y-3">
      <Progress value={progress} className="h-1.5 bg-zinc-800" />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-400">{message}</p>
        {!done ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-rose-400 hover:text-rose-300"
            onClick={handleCancel}
            disabled={cancelled}
          >
            {cancelled ? "Cancelling…" : "Cancel"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-zinc-500 hover:text-zinc-300"
            onClick={onClose}
          >
            Close
          </Button>
        )}
      </div>
    </div>
  );
}

/** Whether an SSEProgress operation is currently running — use to prevent dialog close. */
export function useSSEDialogLock() {
  const [locked, setLocked] = useState(false);
  return {
    locked,
    lock: () => setLocked(true),
    unlock: () => setLocked(false),
  };
}
