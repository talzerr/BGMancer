import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger, LogLevel } from "../logger";

function parseLastCall(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
  return JSON.parse(lastCall[0] as string);
}

describe("logger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("LogLevel enum", () => {
    it("should have the expected values", () => {
      expect(LogLevel.Debug).toBe("debug");
      expect(LogLevel.Info).toBe("info");
      expect(LogLevel.Warn).toBe("warn");
      expect(LogLevel.Error).toBe("error");
    });
  });

  describe("createLogger", () => {
    it("should create a logger with a fixed module name", () => {
      const log = createLogger("youtube");
      log.info("search completed");
      const entry = parseLastCall(logSpy);
      expect(entry.module).toBe("youtube");
    });
  });

  describe("debug", () => {
    it("should call console.log with structured JSON", () => {
      const log = createLogger("test-module");
      log.debug("debug message");
      expect(logSpy).toHaveBeenCalledOnce();
      const entry = parseLastCall(logSpy);
      expect(entry.level).toBe("debug");
      expect(entry.module).toBe("test-module");
      expect(entry.message).toBe("debug message");
      expect(entry.timestamp).toBeDefined();
      expect(entry.context).toBeUndefined();
      expect(entry.error).toBeUndefined();
    });

    it("should include context when provided", () => {
      const log = createLogger("mod");
      log.debug("msg", { key: "value", num: 42 });
      const entry = parseLastCall(logSpy);
      expect(entry.context).toEqual({ key: "value", num: 42 });
    });

    it("should omit context when empty object is provided", () => {
      const log = createLogger("mod");
      log.debug("msg", {});
      const entry = parseLastCall(logSpy);
      expect(entry.context).toBeUndefined();
    });
  });

  describe("info", () => {
    it("should call console.log with info level", () => {
      const log = createLogger("youtube");
      log.info("search completed", { query: "elden ring" });
      expect(logSpy).toHaveBeenCalledOnce();
      const entry = parseLastCall(logSpy);
      expect(entry.level).toBe("info");
      expect(entry.module).toBe("youtube");
      expect(entry.message).toBe("search completed");
      expect(entry.context).toEqual({ query: "elden ring" });
    });
  });

  describe("warn", () => {
    it("should call console.warn with warn level", () => {
      const log = createLogger("director");
      log.warn("pool exhausted", { assembled: 30, target: 50 });
      expect(warnSpy).toHaveBeenCalledOnce();
      const entry = parseLastCall(warnSpy);
      expect(entry.level).toBe("warn");
      expect(entry.module).toBe("director");
      expect(entry.context).toEqual({ assembled: 30, target: 50 });
    });
  });

  describe("error", () => {
    it("should call console.error with error level", () => {
      const log = createLogger("tagger");
      log.error("LLM call failed", { batch: 2 });
      expect(errorSpy).toHaveBeenCalledOnce();
      const entry = parseLastCall(errorSpy);
      expect(entry.level).toBe("error");
      expect(entry.module).toBe("tagger");
      expect(entry.context).toEqual({ batch: 2 });
      expect(entry.error).toBeUndefined();
    });

    it("should serialize Error objects", () => {
      const log = createLogger("tagger");
      const err = new Error("something broke");
      err.name = "CustomError";
      log.error("LLM failed", { batch: 1 }, err);
      const entry = parseLastCall(errorSpy);
      expect(entry.error).toEqual({
        name: "CustomError",
        message: "something broke",
        stack: expect.stringContaining("something broke"),
      });
    });

    it("should handle non-Error objects as the error argument", () => {
      const log = createLogger("mod");
      log.error("failed", {}, "string error");
      const entry = parseLastCall(errorSpy);
      expect(entry.error).toEqual({
        name: "Unknown",
        message: "string error",
      });
    });

    it("should handle undefined context with error", () => {
      const log = createLogger("mod");
      const err = new Error("fail");
      log.error("msg", undefined, err);
      const entry = parseLastCall(errorSpy);
      expect(entry.context).toBeUndefined();
      expect(entry.error).toBeDefined();
    });
  });

  describe("timestamp", () => {
    it("should produce a valid ISO 8601 timestamp", () => {
      const log = createLogger("mod");
      log.info("msg");
      const entry = parseLastCall(logSpy);
      const ts = entry.timestamp as string;
      expect(new Date(ts).toISOString()).toBe(ts);
    });
  });
});
