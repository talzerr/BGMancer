import { createLogger } from "@/lib/logger";

const log = createLogger("sse");

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "X-Accel-Buffering": "no",
} as const;

export function makeSSEStream<T>() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const send = (event: T) => {
    if (closed) return;
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    } catch {
      closed = true;
      log.warn("enqueue failed — stream closed by client");
    }
  };

  const close = () => {
    if (closed) return;
    closed = true;
    try {
      controller.close();
    } catch {
      log.warn("close failed — stream already closed");
    }
  };

  return { stream, send, close };
}

/** Extract a short, user-friendly message from an error. Strips SQL queries and long stack traces. */
export function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Strip "Failed query: ..." SQL dumps — show only the first line / reason
  const firstLine = raw.split("\n")[0];
  if (firstLine.startsWith("Failed query:")) {
    return "A database query failed. Check the server logs for details.";
  }
  // Truncate overly long messages
  if (firstLine.length > 200) return `${firstLine.slice(0, 200)}…`;
  return firstLine;
}
