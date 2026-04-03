/* eslint-disable no-console */
/**
 * Structured logger for Cloudflare Workers.
 *
 * Wraps console.log/warn/error with JSON-structured output that
 * Cloudflare Workers Logs auto-indexes for querying.
 *
 * Usage:
 *   import { createLogger } from "@/lib/logger";
 *   const log = createLogger("youtube");
 *   log.info("search completed", { query, resultCount: 3 });
 *   log.error("LLM call failed", { gameTitle, batch: 2 }, err);
 */

export enum LogLevel {
  Debug = "debug",
  Info = "info",
  Warn = "warn",
  Error = "error",
}

export interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>, err?: unknown): void;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function serializeError(err: unknown): LogEntry["error"] {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { name: "Unknown", message: String(err) };
}

function buildEntry(
  level: LogLevel,
  module: string,
  message: string,
  context?: Record<string, unknown>,
  err?: unknown,
): LogEntry {
  const entry: LogEntry = {
    level,
    module,
    message,
    timestamp: new Date().toISOString(),
  };
  if (context && Object.keys(context).length > 0) entry.context = context;
  if (err !== undefined) entry.error = serializeError(err);
  return entry;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createLogger(module: string): Logger {
  return {
    debug(message: string, context?: Record<string, unknown>): void {
      console.log(JSON.stringify(buildEntry(LogLevel.Debug, module, message, context)));
    },

    info(message: string, context?: Record<string, unknown>): void {
      console.log(JSON.stringify(buildEntry(LogLevel.Info, module, message, context)));
    },

    warn(message: string, context?: Record<string, unknown>): void {
      console.warn(JSON.stringify(buildEntry(LogLevel.Warn, module, message, context)));
    },

    error(message: string, context?: Record<string, unknown>, err?: unknown): void {
      console.error(JSON.stringify(buildEntry(LogLevel.Error, module, message, context, err)));
    },
  };
}
