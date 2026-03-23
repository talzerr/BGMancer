"use client";

import { useEffect, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

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
            const eventData = JSON.parse(line.slice(5).trim()) as SSEEvent;

            if (eventData.type === "progress") {
              const label = progressLabel
                ? progressLabel(eventData)
                : String(eventData.message ?? "Working…");
              setMessage(label);
              const current = Number(eventData.current ?? 0);
              const total = Number(eventData.total ?? 0);
              if (total > 0) setProgress(Math.round((current / total) * 90) + 5);
            } else if (eventData.type === "done") {
              setProgress(100);
              setMessage(doneLabel ? doneLabel(eventData) : "Done");
              setDone(true);
              onDone?.(eventData);
            } else if (eventData.type === "error") {
              const msg = String(eventData.message ?? "Unknown error");
              setMessage(`Error: ${msg}`);
              onError?.(msg);
              setDone(true);
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const msg = err instanceof Error ? err.message : String(err);
        setMessage(`Error: ${msg}`);
        onError?.(msg);
        setDone(true);
      }
    })();

    return () => abort.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <Progress value={progress} className="h-1.5 bg-zinc-800" />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-400">{message}</p>
        {!done ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-zinc-500 hover:text-zinc-300"
            onClick={() => abortRef.current?.abort()}
          >
            Cancel
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
